import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { MAX_PRODUCT_IMAGES, type Category, type Product, type ProductInput, type SpecItem } from '../../../shared/types';
import { api, errorText, uploadImage, useApi } from '../../api';
import BottleImage from '../../components/BottleImage';
import { Field, FormMessage } from '../../components/FormBits';
import { prepareImage } from '../../image';

interface FormState {
  catalogNo: string;
  nameZh: string;
  nameEn: string;
  winery: string;
  vintage: string;
  volume: string;
  categoryId: string;
  priceCAD: string;
  priceCNY: string;
  hasGiftBox: boolean;
  giftCAD: string;
  giftCNY: string;
  tastingNotes: string;
  styleLabel: string;
  styleDescription: string;
  servingTemp: string;
  pairing: string;
  specs: SpecItem[];
  awardsText: string;
  status: 'active' | 'hidden';
}

const DEFAULT_SPECS: SpecItem[] = [
  { label: '级别', value: 'VQA' },
  { label: '葡萄品种', value: '' },
  { label: '酒精度', value: '' },
  { label: '含糖量', value: '' },
  { label: '规格', value: '' },
];

const EMPTY: FormState = {
  catalogNo: '', nameZh: '', nameEn: '', winery: '', vintage: '', volume: '750ml', categoryId: '',
  priceCAD: '', priceCNY: '', hasGiftBox: false, giftCAD: '5', giftCNY: '25',
  tastingNotes: '', styleLabel: '', styleDescription: '', servingTemp: '', pairing: '',
  specs: DEFAULT_SPECS, awardsText: '', status: 'active',
};

function fromProduct(p: Product): FormState {
  return {
    catalogNo: p.catalogNo, nameZh: p.nameZh, nameEn: p.nameEn, winery: p.winery, vintage: p.vintage, volume: p.volume,
    categoryId: p.categoryId ? String(p.categoryId) : '',
    priceCAD: String(p.price.CAD), priceCNY: String(p.price.CNY),
    hasGiftBox: !!p.giftBox, giftCAD: String(p.giftBox?.CAD ?? 5), giftCNY: String(p.giftBox?.CNY ?? 25),
    tastingNotes: p.tastingNotes, styleLabel: p.styleLabel, styleDescription: p.styleDescription,
    servingTemp: p.servingTemp, pairing: p.pairing,
    specs: p.specs.length ? p.specs : [{ label: '', value: '' }],
    awardsText: p.awards.join('\n'), status: p.status,
  };
}

function toInput(f: FormState): ProductInput {
  return {
    catalogNo: f.catalogNo, nameZh: f.nameZh, nameEn: f.nameEn, winery: f.winery, vintage: f.vintage, volume: f.volume,
    categoryId: f.categoryId ? Number(f.categoryId) : null,
    price: { CAD: Number(f.priceCAD), CNY: Number(f.priceCNY) },
    giftBox: f.hasGiftBox ? { CAD: Number(f.giftCAD), CNY: Number(f.giftCNY) } : null,
    tastingNotes: f.tastingNotes, styleLabel: f.styleLabel, styleDescription: f.styleDescription,
    servingTemp: f.servingTemp, pairing: f.pairing,
    specs: f.specs.filter((s) => s.label.trim() || s.value.trim()),
    awards: f.awardsText.split('\n').map((a) => a.trim()).filter(Boolean),
    status: f.status,
  };
}

export default function AdminProductEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const location = useLocation();
  // Set when we arrive here straight after creating the product.
  const justCreated = (location.state as { created?: boolean } | null)?.created === true;
  const product = useApi<Product>(isNew ? null : `/admin/products/${id}`);
  const { data: categories } = useApi<Category[]>('/admin/categories');

  const [form, setForm] = useState<FormState>(EMPTY);
  const [current, setCurrent] = useState<Product | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (product.data) {
      setForm(fromProduct(product.data));
      setCurrent(product.data);
    }
  }, [product.data]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg({});
  };
  const setSpec = (i: number, patch: Partial<SpecItem>) =>
    set('specs', form.specs.map((s, j) => (i === j ? { ...s, ...patch } : s)));

  if (!isNew && product.error) return <p className="error">加载失败：{product.error.message}</p>;
  if (!isNew && !current) return <p className="muted">加载中…</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nameZh.trim()) return setMsg({ error: '请填写中文名称' });
    if (form.priceCAD === '' || form.priceCNY === '') return setMsg({ error: '请填写加币和人民币价格' });
    setBusy(true);
    try {
      if (isNew) {
        // Stay on this product's page so photos can be uploaded (they need the product to exist).
        const p = await api<Product>('/admin/products', { method: 'POST', body: toInput(form) });
        navigate(`/admin/products/${p.id}`, { replace: true, state: { created: true } });
      } else {
        // Saving an existing product returns to the list.
        const p = await api<Product>(`/admin/products/${id}`, { method: 'PUT', body: toInput(form) });
        navigate('/admin/products', { state: { flash: `已保存「${p.nameZh}」` } });
      }
    } catch (err) {
      setMsg({ error: errorText(err, '保存失败') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!current) return;
    const message = [
      `确定永久删除「${current.nameZh}」吗？`,
      '',
      '· 客户的购买记录、累计金额和折扣都不会受影响（交易记录保存了当时的名称和价格）。',
      '· 该产品会从网站上消失，它的图片也会被删除，且无法恢复。',
      '· 销售统计中，它过去的销量仍按原名称统计，并标注“（已删除）”。',
      '',
      '如只是本月不再销售，建议改为“下架”，以后还可以重新上架。',
    ].join('\n');
    if (!confirm(message)) return;
    try {
      await api(`/admin/products/${current.id}`, { method: 'DELETE' });
      navigate('/admin/products', { replace: true, state: { flash: `已删除「${current.nameZh}」` } });
    } catch (err) {
      setMsg({ error: errorText(err, '删除失败') });
    }
  };

  return (
    <>
      <p className="breadcrumb">
        <Link to="/admin/products">产品</Link>
        <span aria-hidden="true">›</span>
        <span>{isNew ? '新增产品' : current?.nameZh}</span>
      </p>
      {justCreated && <p className="form-success">产品已创建。现在可以在右侧上传图片；修改完信息后点“保存修改”返回列表。</p>}

      <div className="product-edit">
        <form className="card admin-section" onSubmit={submit} noValidate>
          <h1 className="sub-title first">{isNew ? '新增产品' : '编辑产品'}</h1>

          <h2 className="form-group-title">基本信息</h2>
          <div className="form-grid">
            <Field label="中文名称 *">
              <input className="input" value={form.nameZh} onChange={(e) => set('nameZh', e.target.value)} />
            </Field>
            <Field label="英文名称">
              <input className="input" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
            </Field>
            <Field label="酒庄">
              <input className="input" value={form.winery} onChange={(e) => set('winery', e.target.value)} />
            </Field>
            <Field label="分类">
              <select className="input" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
                <option value="">未分类</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-grid form-grid-3">
            <Field label="目录编号" hint="编号决定首页和产品列表的显示顺序">
              <input className="input" value={form.catalogNo} onChange={(e) => set('catalogNo', e.target.value)} />
            </Field>
            <Field label="年份">
              <input className="input" value={form.vintage} onChange={(e) => set('vintage', e.target.value)} />
            </Field>
            <Field label="规格">
              <input className="input" value={form.volume} onChange={(e) => set('volume', e.target.value)} placeholder="750ml / 375ml / 5L" />
            </Field>
          </div>

          <h2 className="form-group-title">价格</h2>
          <div className="form-grid">
            <Field label="加币价格 * ($)">
              <input className="input" type="number" min={0} step="0.01" value={form.priceCAD} onChange={(e) => set('priceCAD', e.target.value)} />
            </Field>
            <Field label="人民币价格 * (¥)">
              <input className="input" type="number" min={0} step="0.01" value={form.priceCNY} onChange={(e) => set('priceCNY', e.target.value)} />
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={form.hasGiftBox} onChange={(e) => set('hasGiftBox', e.target.checked)} />
            提供需另付费的礼盒礼袋
          </label>
          {form.hasGiftBox && (
            <div className="form-grid">
              <Field label="礼盒价格 ($)">
                <input className="input" type="number" min={0} step="0.01" value={form.giftCAD} onChange={(e) => set('giftCAD', e.target.value)} />
              </Field>
              <Field label="礼盒价格 (¥)">
                <input className="input" type="number" min={0} step="0.01" value={form.giftCNY} onChange={(e) => set('giftCNY', e.target.value)} />
              </Field>
            </div>
          )}

          <h2 className="form-group-title">介绍</h2>
          <Field label="品酒笔记">
            <textarea className="input textarea" rows={4} value={form.tastingNotes} onChange={(e) => set('tastingNotes', e.target.value)} />
          </Field>
          <div className="form-grid">
            <Field label="风格">
              <input className="input" value={form.styleLabel} onChange={(e) => set('styleLabel', e.target.value)} placeholder="如：优质白冰葡萄酒" />
            </Field>
            <Field label="风格描述">
              <input className="input" value={form.styleDescription} onChange={(e) => set('styleDescription', e.target.value)} placeholder="如：天然芬芳，厚重饱满" />
            </Field>
            <Field label="饮用温度">
              <input className="input" value={form.servingTemp} onChange={(e) => set('servingTemp', e.target.value)} placeholder="如：6 - 8 °C" />
            </Field>
            <Field label="建议配食">
              <input className="input" value={form.pairing} onChange={(e) => set('pairing', e.target.value)} />
            </Field>
          </div>

          <h2 className="form-group-title">技术参数</h2>
          <div className="spec-editor">
            {form.specs.map((s, i) => (
              <div key={i} className="spec-row">
                <input className="input" placeholder="名称（如 酒精度）" value={s.label} onChange={(e) => setSpec(i, { label: e.target.value })} />
                <input className="input" placeholder="内容（如 11%）" value={s.value} onChange={(e) => setSpec(i, { value: e.target.value })} />
                <button type="button" className="icon-button" aria-label="删除此行" onClick={() => set('specs', form.specs.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={() => set('specs', [...form.specs, { label: '', value: '' }])}>
              + 添加参数
            </button>
          </div>

          <h2 className="form-group-title">获得奖项</h2>
          <Field label="每行一个奖项">
            <textarea className="input textarea" rows={4} value={form.awardsText} onChange={(e) => set('awardsText', e.target.value)} />
          </Field>

          <h2 className="form-group-title">上架</h2>
          <div className="form-grid">
            <Field label="状态">
              <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])}>
                <option value="active">在售（网站显示）</option>
                <option value="hidden">下架（网站不显示）</option>
              </select>
            </Field>
          </div>

          <FormMessage {...msg} />
          <div className="button-row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? '保存中…' : isNew ? '创建产品' : '保存修改'}
            </button>
            <Link className="btn btn-ghost" to="/admin/products">
              {isNew ? '取消' : '返回列表（不保存）'}
            </Link>
            {current?.status === 'active' && (
              <Link className="btn btn-ghost" to={`/products/${current.id}`} target="_blank">
                在网站上查看
              </Link>
            )}
            {current && (
              <button type="button" className="btn btn-ghost danger" onClick={remove}>
                删除产品
              </button>
            )}
          </div>
        </form>

        <aside className="card admin-section photo-panel">
          <h2 className="sub-title first">产品图片</h2>
          {current ? (
            <PhotoEditor product={current} onChange={setCurrent} />
          ) : (
            <p className="muted small">请先创建产品，然后上传图片。</p>
          )}
        </aside>
      </div>
    </>
  );
}

function PhotoEditor({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const images = product.images;
  const room = MAX_PRODUCT_IMAGES - images.length;

  const upload = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    setError('');
    const accepted = files.slice(0, room);
    const skipped = files.length - accepted.length;
    setBusy(true);
    const failures: string[] = [];
    try {
      // One at a time, so a slow connection never sends several large requests at once.
      for (let i = 0; i < accepted.length; i++) {
        setProgress(`正在上传 ${i + 1} / ${accepted.length}…`);
        try {
          const blob = await prepareImage(accepted[i]);
          onChange(await uploadImage<Product>(`/admin/products/${product.id}/images`, blob));
        } catch (err) {
          failures.push(`${accepted[i].name}：${err instanceof Error ? err.message : errorText(err, '上传失败')}`);
        }
      }
    } finally {
      setBusy(false);
      setProgress('');
      if (input.current) input.current.value = '';
    }
    const notes = [...failures];
    if (skipped > 0) notes.push(`每个产品最多 ${MAX_PRODUCT_IMAGES} 张，已跳过 ${skipped} 张`);
    if (notes.length) setError(notes.join('；'));
  };

  const saveOrder = async (ids: number[]) => {
    setError('');
    setBusy(true);
    try {
      onChange(await api<Product>(`/admin/products/${product.id}/images/order`, { method: 'PUT', body: { ids } }));
    } catch (err) {
      setError(errorText(err, '调整顺序失败'));
    } finally {
      setBusy(false);
    }
  };

  const move = (i: number, delta: -1 | 1) => {
    const ids = images.map((img) => img.id);
    [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]];
    saveOrder(ids);
  };

  const makeMain = (i: number) => {
    const ids = images.map((img) => img.id);
    const [picked] = ids.splice(i, 1);
    saveOrder([picked, ...ids]);
  };

  const remove = async (imageId: number, i: number) => {
    if (!confirm(i === 0 && images.length > 1 ? '删除主图？下一张将自动成为主图。' : '删除这张图片？')) return;
    setError('');
    setBusy(true);
    try {
      onChange(await api<Product>(`/admin/products/${product.id}/images/${imageId}`, { method: 'DELETE' }));
    } catch (err) {
      setError(errorText(err, '删除失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {images.length === 0 ? (
        <div className="photo-preview">
          <BottleImage product={product} />
        </div>
      ) : (
        <ol className="photo-grid">
          {images.map((img, i) => (
            <li key={img.id} className={`photo-item${i === 0 ? ' main' : ''}`}>
              <div className="photo-thumb">
                <img src={img.url} alt={`第 ${i + 1} 张`} loading="lazy" />
                {i === 0 && <span className="photo-badge">主图</span>}
              </div>
              <div className="photo-actions">
                <button type="button" className="icon-button" aria-label="前移" title="前移" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  ←
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="后移"
                  title="后移"
                  disabled={busy || i === images.length - 1}
                  onClick={() => move(i, 1)}
                >
                  →
                </button>
                <button type="button" className="icon-button" aria-label="删除" title="删除" disabled={busy} onClick={() => remove(img.id, i)}>
                  ×
                </button>
              </div>
              {i > 0 && (
                <button type="button" className="link-button photo-main-link" disabled={busy} onClick={() => makeMain(i)}>
                  设为主图
                </button>
              )}
            </li>
          ))}
        </ol>
      )}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => upload(e.target.files)}
      />
      <div className="button-row">
        <button type="button" className="btn btn-primary" disabled={busy || room <= 0} onClick={() => input.current?.click()}>
          {progress || (images.length ? '+ 添加图片' : '上传图片')}
        </button>
        <span className="muted small">
          {images.length} / {MAX_PRODUCT_IMAGES} 张
        </span>
      </div>
      <FormMessage error={error} />
      <p className="muted small">
        可一次选择多张。第一张为主图，显示在首页产品卡片上。图片的上传、删除和调整顺序会立即保存。支持 JPG、PNG、WebP，大图会自动缩小。
      </p>
    </>
  );
}
