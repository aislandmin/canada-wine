import { useEffect, useState, type FormEvent } from 'react';
import { CURRENCIES, type Currency, type PublicSettings } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { Field, FormMessage } from '../../components/FormBits';
import { CURRENCY_LABEL } from '../../format';

interface TierRow {
  min: string;
  pct: string;
}

interface FormState {
  siteTitle: string;
  siteSubtitle: string;
  highlightsText: string;
  policyText: string;
  contactText: string;
  windowYears: string;
  tiers: Record<Currency, TierRow[]>;
}

function fromSettings(s: PublicSettings): FormState {
  return {
    siteTitle: s.siteTitle,
    siteSubtitle: s.siteSubtitle,
    highlightsText: s.highlights.join('\n'),
    policyText: s.policyText,
    contactText: s.contactText,
    windowYears: String(s.windowYears),
    tiers: {
      CAD: s.tiers.CAD.map((t) => ({ min: String(t.min), pct: String(Math.round(t.rate * 1000) / 10) })),
      CNY: s.tiers.CNY.map((t) => ({ min: String(t.min), pct: String(Math.round(t.rate * 1000) / 10) })),
    },
  };
}

export default function AdminSettings() {
  const { data } = useApi<PublicSettings>('/admin/settings');
  const [form, setForm] = useState<FormState | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(fromSettings(data));
  }, [data]);

  if (!form) return <p className="muted">加载中…</p>;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm({ ...form, [k]: v });
    setMsg({});
  };
  const setTier = (c: Currency, i: number, patch: Partial<TierRow>) =>
    set('tiers', { ...form.tiers, [c]: form.tiers[c].map((t, j) => (i === j ? { ...t, ...patch } : t)) });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        siteTitle: form.siteTitle,
        siteSubtitle: form.siteSubtitle,
        highlights: form.highlightsText.split('\n').map((h) => h.trim()).filter(Boolean),
        policyText: form.policyText,
        contactText: form.contactText,
        windowYears: Number(form.windowYears),
        tiers: {
          CAD: form.tiers.CAD.map((t) => ({ min: Number(t.min), rate: Number(t.pct) / 100 })),
          CNY: form.tiers.CNY.map((t) => ({ min: Number(t.min), rate: Number(t.pct) / 100 })),
        },
      };
      const saved = await api<PublicSettings>('/admin/settings', { method: 'PUT', body });
      setForm(fromSettings(saved));
      setMsg({ success: '已保存。刷新页面后网站即显示新内容。' });
    } catch (err) {
      setMsg({ error: errorText(err, '保存失败') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="section-title">网站设置</h1>

      <section className="card admin-section">
        <h2 className="sub-title first">首页文字</h2>
        <Field label="网站标题">
          <input className="input" value={form.siteTitle} onChange={(e) => set('siteTitle', e.target.value)} />
        </Field>
        <Field label="副标题">
          <input className="input" value={form.siteSubtitle} onChange={(e) => set('siteSubtitle', e.target.value)} />
        </Field>
        <Field label="首页亮点" hint="每行一条，最多 8 条">
          <textarea className="input textarea" rows={3} value={form.highlightsText} onChange={(e) => set('highlightsText', e.target.value)} />
        </Field>
        <Field label="联系方式说明" hint="显示在页脚和产品页，例如：订购请加微信 xxx 或致电 xxx">
          <input className="input" value={form.contactText} onChange={(e) => set('contactText', e.target.value)} />
        </Field>
      </section>

      <section className="card admin-section">
        <h2 className="sub-title first">折扣政策</h2>
        <Field label="政策说明">
          <textarea className="input textarea" rows={5} value={form.policyText} onChange={(e) => set('policyText', e.target.value)} />
        </Field>
        <Field label="累计统计年限" hint="折扣按订货日往前多少年的累计金额计算">
          <input className="input narrow-input" type="number" min={1} max={10} value={form.windowYears} onChange={(e) => set('windowYears', e.target.value)} />
        </Field>

        <div className="tier-editors">
          {CURRENCIES.map((c) => (
            <div key={c} className="tier-editor">
              <h3 className="form-group-title">{CURRENCY_LABEL[c]}档位</h3>
              <div className="tier-row tier-head" aria-hidden="true">
                <span>累计金额达到</span>
                <span>折扣 %</span>
                <span />
              </div>
              {form.tiers[c].map((t, i) => (
                <div key={i} className="tier-row">
                  <input className="input" type="number" min={0} value={t.min} onChange={(e) => setTier(c, i, { min: e.target.value })} aria-label="金额" />
                  <input className="input" type="number" min={0} max={90} step="0.5" value={t.pct} onChange={(e) => setTier(c, i, { pct: e.target.value })} aria-label="折扣" />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="删除此档"
                    onClick={() => set('tiers', { ...form.tiers, [c]: form.tiers[c].filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost" onClick={() => set('tiers', { ...form.tiers, [c]: [...form.tiers[c], { min: '', pct: '' }] })}>
                + 添加档位
              </button>
            </div>
          ))}
        </div>
        <p className="muted small">修改档位后，所有客户的可享折扣会按新档位重新计算；已记录的交易金额不会改变。</p>
      </section>

      <FormMessage {...msg} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? '保存中…' : '保存设置'}
      </button>
    </form>
  );
}
