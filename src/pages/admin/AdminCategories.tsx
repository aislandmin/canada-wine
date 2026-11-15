import { useState, type FormEvent } from 'react';
import type { Category, Product } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { FormMessage, useFlash } from '../../components/FormBits';

export default function AdminCategories() {
  const { data, error, reload } = useApi<Category[]>('/admin/categories');
  const { data: products } = useApi<Product[]>('/admin/products');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useFlash(); // fades after a few seconds
  const [busy, setBusy] = useState(false);

  const list = [...(data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const count = (id: number) => (products ?? []).filter((p) => p.categoryId === id).length;

  const run = async (fn: () => Promise<unknown>, successText: string) => {
    setActionError('');
    setSuccess('');
    setBusy(true);
    try {
      await fn();
      setSuccess(successText);
      reload();
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  /** Swap a category with its neighbour; renumber all so the order is always 0,1,2,… */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...list];
    [next[index], next[index + dir]] = [next[index + dir], next[index]];
    run(
      () =>
        Promise.all(
          next
            .map((c, i) => ({ c, i }))
            .filter(({ c, i }) => c.sortOrder !== i)
            .map(({ c, i }) => api(`/admin/categories/${c.id}`, { method: 'PUT', body: { name: c.name, sortOrder: i } })),
        ),
      '顺序已更新',
    );
  };

  return (
    <>
      <h1 className="section-title">分类</h1>
      <p className="muted small">分类按下面的顺序显示在首页的筛选按钮中。删除分类不会删除产品，相关产品会变为“未分类”。</p>
      <FormMessage error={actionError} />
      {success && (
        <p className="form-success flash" role="status">
          {success}
        </p>
      )}
      {error && <p className="error">加载失败：{error.message}</p>}

      <div className="card admin-section">
        <div className="category-list">
          <div className="category-row category-head">
            <span>分类名称</span>
            <span>包含产品</span>
            <span>显示顺序</span>
            <span>操作</span>
          </div>
          {list.map((c, i) => (
            <CategoryRow
              key={`${c.id}-${c.name}`}
              category={c}
              productCount={count(c.id)}
              isFirst={i === 0}
              isLast={i === list.length - 1}
              busy={busy}
              onMove={(dir) => move(i, dir)}
              onSave={(name) => run(() => api(`/admin/categories/${c.id}`, { method: 'PUT', body: { name, sortOrder: c.sortOrder } }), '已保存')}
              onDelete={() => {
                const n = count(c.id);
                if (!confirm(`删除分类「${c.name}」？${n ? `其中 ${n} 个产品将变为“未分类”。` : ''}`)) return;
                run(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' }), '已删除');
              }}
            />
          ))}
          {list.length === 0 && data && <p className="muted small">还没有分类。</p>}
          <NewCategory
            busy={busy}
            onAdd={(name) =>
              run(
                () => api('/admin/categories', { method: 'POST', body: { name, sortOrder: list.length ? Math.max(...list.map((c) => c.sortOrder)) + 1 : 0 } }),
                '已添加',
              )
            }
          />
        </div>
      </div>
    </>
  );
}

function CategoryRow(props: {
  category: Category;
  productCount: number;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (dir: -1 | 1) => void;
  onSave: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(props.category.name);
  const dirty = name.trim() !== props.category.name;
  const cancel = () => {
    setName(props.category.name);
    setEditing(false);
  };
  return (
    <div className={`category-row${editing ? ' editing' : ''}`}>
      {editing ? (
        <div className="category-rename">
          <input
            className="input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            aria-label="新的分类名称"
          />
          {props.productCount > 0 && (
            <span className="form-hint">改名后，该分类下的 {props.productCount} 个产品会自动显示新名称。</span>
          )}
        </div>
      ) : (
        <span className="category-name">{props.category.name}</span>
      )}
      <span className="category-count">{props.productCount} 个产品</span>
      <span className="order-buttons">
        <button
          type="button"
          className="icon-button"
          aria-label="上移"
          title="上移"
          disabled={props.isFirst || props.busy}
          onClick={() => props.onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="下移"
          title="下移"
          disabled={props.isLast || props.busy}
          onClick={() => props.onMove(1)}
        >
          ↓
        </button>
      </span>
      <span className="button-row">
        {editing ? (
          <>
            <button
              className="btn btn-primary"
              disabled={!dirty || !name.trim() || props.busy}
              onClick={() => {
                props.onSave(name.trim());
                setEditing(false);
              }}
            >
              保存
            </button>
            <button className="btn btn-ghost" onClick={cancel}>
              取消
            </button>
          </>
        ) : (
          <>
            <button className="btn" disabled={props.busy} onClick={() => setEditing(true)}>
              改名
            </button>
            <button className="btn btn-ghost danger" disabled={props.busy} onClick={props.onDelete}>
              删除
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function NewCategory({ busy, onAdd }: { busy: boolean; onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim());
    setName('');
  };
  return (
    <form className="category-row category-new" onSubmit={submit}>
      <input className="input" placeholder="新分类名称，如：起泡酒" value={name} onChange={(e) => setName(e.target.value)} aria-label="新分类名称" />
      <span className="muted small">添加到最后</span>
      <span />
      <span className="button-row">
        <button className="btn btn-primary" disabled={!name.trim() || busy}>
          + 添加分类
        </button>
      </span>
    </form>
  );
}
