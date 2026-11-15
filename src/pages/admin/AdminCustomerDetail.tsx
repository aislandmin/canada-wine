import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatPhone } from '../../../shared/phone';
import type { AdminUser, Transaction } from '../../../shared/types';
import { api, errorText, useApi } from '../../api';
import { FormMessage, splitPhone, useFlash } from '../../components/FormBits';
import SummaryView from '../../components/SummaryView';
import { dateZh } from '../../format';
import { TempPassword } from './AdminCustomers';
import CustomerFields, { type CustomerForm } from './CustomerFields';
import TransactionForm from './TransactionForm';

type TxMode = { kind: 'none' } | { kind: 'new' } | { kind: 'edit'; tx: Transaction };

export default function AdminCustomerDetail() {
  const id = Number(useParams().id);
  const { data: user, error, reload } = useApi<AdminUser>(`/admin/users/${id}`);
  const [editing, setEditing] = useState(false);
  const [txMode, setTxMode] = useState<TxMode>({ kind: 'none' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [flash, setFlash] = useFlash();

  if (error) return <p className="error">加载失败：{error.message}</p>;
  if (!user) return <p className="muted">加载中…</p>;

  const afterTxChange = (message: string) => {
    setTxMode({ kind: 'none' });
    setRefreshKey((k) => k + 1);
    setFlash(message);
  };

  const remove = async (t: Transaction) => {
    if (!confirm(`确定删除 ${dateZh(t.orderDate)} 的这笔交易吗？删除后无法恢复。`)) return;
    try {
      await api(`/admin/transactions/${t.id}`, { method: 'DELETE' });
      afterTxChange('交易已删除');
    } catch (err) {
      alert(errorText(err));
    }
  };

  return (
    <>
      <p className="breadcrumb">
        <Link to="/admin/customers">客户</Link>
        <span aria-hidden="true">›</span>
        <span>{user.name}</span>
      </p>

      <section className="card admin-section customer-card">
        <div className="customer-card-head">
          <div>
            <h1 className="detail-title">
              {user.name}
              {user.status === 'disabled' && <span className="pill">已停用</span>}
            </h1>
            <p className="customer-contact">
              {user.phone && <span>{formatPhone(user.phone)}</span>}
              {user.email && <span>{user.email}</span>}
              {user.wechat && <span>微信 {user.wechat}</span>}
              {user.company && <span>{user.company}</span>}
            </p>
            <p className="muted small">
              注册于 {user.createdAt.slice(0, 10)} · {user.lastLoginAt ? `最近登录 ${user.lastLoginAt.slice(0, 10)}` : '从未登录'}
            </p>
            {user.adminNote && <p className="admin-note">备注：{user.adminNote}</p>}
          </div>
          <div className="button-row">
            <button className="btn" onClick={() => setEditing((e) => !e)}>
              {editing ? '收起' : '编辑资料'}
            </button>
            <ResetPassword user={user} />
            <ToggleStatus user={user} onChanged={reload} />
          </div>
        </div>
        {user.status === 'disabled' && (
          <p className="disabled-notice">该账号已停用：客户无法登录，交易记录仍然保留。点击“启用账号”可恢复。</p>
        )}
        {editing && (
          <EditCustomer
            user={user}
            onSaved={() => {
              setEditing(false);
              reload();
            }}
          />
        )}
      </section>

      {flash && <p className="form-success flash">{flash}</p>}

      <SummaryView
        audience="admin"
        path={(asOf) => `/admin/users/${id}/summary?asOf=${asOf}`}
        refreshKey={refreshKey}
        txToolbar={
          txMode.kind === 'none' && (
            <button className="btn btn-primary" onClick={() => setTxMode({ kind: 'new' })}>
              + 记录新交易
            </button>
          )
        }
        beforeList={
          txMode.kind !== 'none' && (
            <TransactionForm
              key={txMode.kind === 'edit' ? txMode.tx.id : 'new'}
              userId={id}
              initial={txMode.kind === 'edit' ? txMode.tx : undefined}
              onSaved={() => afterTxChange(txMode.kind === 'edit' ? '交易已更新' : '交易已保存')}
              onCancel={() => setTxMode({ kind: 'none' })}
            />
          )
        }
        txActions={(t) => (
          <>
            <button className="link-button" onClick={() => setTxMode({ kind: 'edit', tx: t })}>
              修改
            </button>
            <button className="link-button danger" onClick={() => remove(t)}>
              删除
            </button>
          </>
        )}
      />
    </>
  );
}

function EditCustomer({ user, onSaved }: { user: AdminUser; onSaved: () => void }) {
  const phone = splitPhone(user.phone);
  const [form, setForm] = useState<CustomerForm>({
    name: user.name,
    countryCode: phone.countryCode,
    phone: phone.local,
    email: user.email ?? '',
    wechat: user.wechat,
    company: user.company,
    adminNote: user.adminNote,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}`, { method: 'PUT', body: form });
      onSaved();
    } catch (err) {
      setError(errorText(err, '保存失败'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="edit-customer" onSubmit={submit} noValidate>
      <CustomerFields form={form} onChange={setForm} />
      <FormMessage error={error} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? '保存中…' : '保存资料'}
      </button>
    </form>
  );
}

/** Disable / re-enable a customer account, with a confirmation. */
function ToggleStatus({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const disabled = user.status === 'disabled';

  const toggle = async () => {
    const question = disabled
      ? `启用「${user.name}」的账号？启用后客户可以重新登录。`
      : `停用「${user.name}」的账号？停用后客户将无法登录（已登录的会被立即退出），交易记录会保留，之后可随时启用。`;
    if (!confirm(question)) return;
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}/status`, { method: 'POST', body: { status: disabled ? 'active' : 'disabled' } });
      onChanged();
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className={`btn ${disabled ? 'btn-primary' : 'btn-ghost danger'}`} onClick={toggle} disabled={busy}>
      {disabled ? '启用账号' : '停用账号'}
    </button>
  );
}

function ResetPassword({ user }: { user: AdminUser }) {
  const [temp, setTemp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    if (!confirm(`为「${user.name}」生成新的临时密码？旧密码将失效，客户需重新登录。`)) return;
    setBusy(true);
    try {
      const r = await api<{ tempPassword: string }>(`/admin/users/${user.id}/reset-password`, { method: 'POST' });
      setTemp(r.tempPassword);
    } catch (err) {
      alert(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn" onClick={reset} disabled={busy}>
        重置密码
      </button>
      {temp && (
        <div className="temp-password-pop">
          <TempPassword user={user} password={temp} />
          <button className="link-button" onClick={() => setTemp(null)}>
            关闭
          </button>
        </div>
      )}
    </>
  );
}
