import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { applyDiscount, deservedDiscount, formatRate, itemsSubtotal } from '../../../shared/discount';
import { CURRENCIES, type Currency, type DiscountPreview, type Product, type Transaction } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { Field, FormMessage } from '../../components/FormBits';
import { CURRENCY_LABEL, dateZh, money, todayLocal } from '../../format';
import { useSettings } from '../../settings';

interface Line {
  key: number;
  productId: number | null;
  /** For a gift-box line: the product whose gift box this is (for re-pricing on currency change). */
  giftFor: number | null;
  /** A hand-typed line from an older record (before every line had to be a catalogue product). Kept as-is. */
  legacy?: boolean;
  name: string;
  qty: string;
  unitPrice: string;
}

let nextKey = 1;
const newLine = (partial: Partial<Line> = {}): Line => ({
  key: nextKey++,
  productId: null,
  giftFor: null,
  name: '',
  qty: '1',
  unitPrice: '',
  ...partial,
});

/** 0.15 -> "15" (avoids 15.000000000000002). */
const pct = (rate: number) => String(Math.round(rate * 1000) / 10);

const productLabel = (p: Product) => [p.nameZh, p.volume].filter(Boolean).join(' ');

interface Props {
  userId: number;
  /** Editing an existing transaction; omit to record a new one. */
  initial?: Transaction;
  onSaved: () => void;
  onCancel: () => void;
}

export default function TransactionForm({ userId, initial, onSaved, onCancel }: Props) {
  const { tiers } = useSettings();
  const { data: products } = useApi<Product[]>('/admin/products');
  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);

  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? todayLocal());
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? 'CNY');
  const [lines, setLines] = useState<Line[]>(() =>
    initial
      ? initial.items.map((it) =>
          newLine({
            // A saved gift-box line stores the wine it belongs to in productId.
            productId: it.giftBox ? null : it.productId,
            giftFor: it.giftBox ? it.productId : null,
            legacy: !it.giftBox && it.productId == null,
            name: it.name,
            qty: String(it.qty),
            unitPrice: String(it.unitPrice),
          }),
        )
      : [newLine()],
  );
  const [ratePct, setRatePct] = useState(initial ? pct(initial.discountRate) : "0");
  const rateTouched = useRef(!!initial);
  const [note, setNote] = useState(initial?.note ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Every line is a catalogue product (or its gift box); old hand-typed lines are kept when editing.
  const hasProduct = (l: Line) => l.productId != null || l.giftFor != null || l.legacy === true;
  const validLines = lines.filter(
    (l) => hasProduct(l) && l.name.trim() && Number(l.qty) > 0 && l.unitPrice !== '' && Number(l.unitPrice) >= 0,
  );
  const subtotal = itemsSubtotal(validLines.map((l) => ({ qty: Number(l.qty), unitPrice: Number(l.unitPrice) })));
  const rate = Math.min(Math.max(Number(ratePct) || 0, 0), 90) / 100;
  const calculated = applyDiscount(subtotal, rate);

  const [manualAmount, setManualAmount] = useState(() => !!initial && initial.amount !== applyDiscount(initial.subtotal ?? 0, initial.discountRate));
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const shownAmount = manualAmount || validLines.length === 0 ? amount : String(calculated);

  // Suggested discount: from what the customer had already paid for existing orders up to
  // and including the order date (not this order). Re-fetched when the date changes.
  const preview = useApi<DiscountPreview>(
    `/admin/users/${userId}/discount-preview?date=${orderDate}${initial ? `&excludeTx=${initial.id}` : ''}`,
  ).data;
  const suggestion = preview ? deservedDiscount(preview.priorTotals, tiers) : null;
  const suggestedPct = suggestion ? pct(suggestion.rate) : null;
  useEffect(() => {
    if (suggestedPct != null && !rateTouched.current) setRatePct(suggestedPct);
  }, [suggestedPct]);

  const updateLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const chooseProduct = (key: number, value: string) => {
    const p = byId.get(Number(value));
    if (p) updateLine(key, { productId: p.id, giftFor: null, name: productLabel(p), unitPrice: String(p.price[currency]) });
  };

  const addGiftBox = (line: Line) => {
    const p = line.productId ? byId.get(line.productId) : undefined;
    if (!p?.giftBox) return;
    setLines((ls) => {
      const i = ls.findIndex((l) => l.key === line.key);
      const gift = newLine({ giftFor: p.id, name: `礼盒礼袋（${p.nameZh}）`, qty: line.qty, unitPrice: String(p.giftBox![currency]) });
      return [...ls.slice(0, i + 1), gift, ...ls.slice(i + 1)];
    });
  };

  // Re-price catalogue lines when the currency changes.
  const changeCurrency = (c: Currency) => {
    setCurrency(c);
    setLines((ls) =>
      ls.map((l) => {
        if (l.giftFor) {
          const p = byId.get(l.giftFor);
          return p?.giftBox ? { ...l, unitPrice: String(p.giftBox[c]) } : l;
        }
        const p = l.productId ? byId.get(l.productId) : undefined;
        return p ? { ...l, unitPrice: String(p.price[c]) } : l;
      }),
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    // A line counts as "started" once a product is chosen or a price typed; blank new lines are ignored.
    const incomplete = lines.filter((l) => (hasProduct(l) || l.unitPrice) && !validLines.includes(l));
    if (incomplete.some((l) => !hasProduct(l))) return setError('请为每一行选择产品');
    if (incomplete.length) return setError('有商品行未填写完整（数量、单价）');
    const finalAmount = Number(shownAmount);
    if (shownAmount === '' || !Number.isFinite(finalAmount) || finalAmount < 0) return setError('请填写实付金额');

    setBusy(true);
    try {
      const body = {
        orderDate,
        currency,
        items: validLines.map((l) => ({
          productId: l.giftFor ?? l.productId,
          name: l.name.trim(),
          qty: Number(l.qty),
          unitPrice: Number(l.unitPrice),
          ...(l.giftFor ? { giftBox: true } : {}),
        })),
        discountRate: rate,
        amount: finalAmount,
        note,
      };
      if (initial) await api(`/admin/transactions/${initial.id}`, { method: 'PUT', body });
      else await api(`/admin/users/${userId}/transactions`, { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(errorText(err, '保存失败，请稍后再试'));
    } finally {
      setBusy(false);
    }
  };

  const quickRates = [0, ...new Set(tiers[currency].map((t) => Number(pct(t.rate))))];

  return (
    <form className="card tx-form" onSubmit={submit} noValidate>
      <h3 className="sub-title first">{initial ? '修改交易' : '记录新交易'}</h3>

      <div className="form-grid">
        <Field label="订货日期 *">
          <input className="input" type="date" value={orderDate} onChange={(e) => e.target.value && setOrderDate(e.target.value)} />
        </Field>
        <Field label="币种 *">
          <div className="segmented segmented-lg" role="group">
            {CURRENCIES.map((c) => (
              <button type="button" key={c} className={currency === c ? 'active' : ''} onClick={() => changeCurrency(c)}>
                {CURRENCY_LABEL[c]}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="line-items">
        <div className="line-head" aria-hidden="true">
          <span>商品</span>
          <span>数量</span>
          <span>单价</span>
          <span className="num">小计</span>
          <span />
        </div>
        {lines.map((l) => {
          const p = l.productId ? byId.get(l.productId) : undefined;
          const lineTotal = Number(l.qty) * Number(l.unitPrice);
          return (
            <div key={l.key} className="line">
              <div className="line-product">
                {l.giftFor ? (
                  <span className="line-fixed-name">{l.name}</span>
                ) : l.legacy ? (
                  <span className="line-fixed-name">
                    {l.name} <span className="muted small">（旧记录，手动填写）</span>
                  </span>
                ) : (
                  <select className="input" value={l.productId ?? ''} onChange={(e) => chooseProduct(l.key, e.target.value)} aria-label="选择产品">
                    <option value="" disabled>
                      请选择产品…
                    </option>
                    {(products ?? []).map((pr) => (
                      <option key={pr.id} value={pr.id}>
                        {pr.catalogNo ? `No.${pr.catalogNo} ` : ''}
                        {productLabel(pr)}
                        {pr.status === 'hidden' ? '（已下架）' : ''}
                      </option>
                    ))}
                  </select>
                )}
                {p?.giftBox && !lines.some((x) => x.giftFor === p.id) && (
                  <button type="button" className="link-button" onClick={() => addGiftBox(l)}>
                    + 加礼盒礼袋（{money(p.giftBox[currency], currency)}/个）
                  </button>
                )}
              </div>
              <input
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={l.qty}
                onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                aria-label="数量"
              />
              <input
                className="input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={l.unitPrice}
                onChange={(e) => updateLine(l.key, { unitPrice: e.target.value })}
                aria-label="单价"
              />
              <span className="num line-total">{Number.isFinite(lineTotal) && l.unitPrice !== '' ? money(lineTotal, currency) : '—'}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="删除此行"
                onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
              >
                ×
              </button>
            </div>
          );
        })}
        <button type="button" className="btn btn-ghost" onClick={() => setLines((ls) => [...ls, newLine()])}>
          + 添加商品
        </button>
      </div>

      <div className="tx-summary">
        <div className="tx-summary-row">
          <span>原价合计</span>
          <strong>{money(subtotal, currency)}</strong>
        </div>

        <div className="tx-summary-row tx-discount">
          <span>折扣</span>
          <div className="discount-inputs">
            {quickRates.map((r) => (
              <button
                type="button"
                key={r}
                className={`chip${Number(ratePct) === r ? ' active' : ''}`}
                onClick={() => {
                  rateTouched.current = true;
                  setRatePct(String(r));
                }}
              >
                {r}%
              </button>
            ))}
            <span className="pct-input">
              <input
                className="input"
                type="number"
                min={0}
                max={90}
                step="0.5"
                value={ratePct}
                onChange={(e) => {
                  rateTouched.current = true;
                  setRatePct(e.target.value);
                }}
                aria-label="折扣百分比"
              />
              %
            </span>
          </div>
        </div>
        {preview && suggestion && suggestedPct != null && (
          <div className="preview-note">
            <p>
              {dateZh(preview.windowStart)} 至 {dateZh(preview.windowEnd)}（含订货当天）已有订单实付：
              {money(preview.priorTotals.CNY, 'CNY')} / {money(preview.priorTotals.CAD, 'CAD')}（不含本单）
            </p>
            <p>
              本单按政策应享 <strong>{suggestion.rate ? formatRate(suggestion.rate) : '无折扣'}</strong>
              {Number(ratePct) !== Number(suggestedPct) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    rateTouched.current = true;
                    setRatePct(suggestedPct);
                  }}
                >
                  使用此折扣
                </button>
              )}
            </p>
          </div>
        )}

        <div className="tx-summary-row">
          <span>实付金额 *</span>
          <span className="amount-input">
            <input
              className="input"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={shownAmount}
              readOnly={!manualAmount && validLines.length > 0}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="实付金额"
            />
          </span>
        </div>
        {validLines.length > 0 && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={manualAmount}
              onChange={(e) => {
                setManualAmount(e.target.checked);
                if (e.target.checked) setAmount(String(calculated));
              }}
            />
            手动修改实付金额（如有抹零、运费等）
          </label>
        )}
        <p className="muted small">计入客户累计消费的是“实付金额”。</p>
      </div>

      <Field label="备注">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Field>

      <FormMessage error={error} />
      <div className="button-row">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? '保存中…' : initial ? '保存修改' : '保存交易'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </form>
  );
}
