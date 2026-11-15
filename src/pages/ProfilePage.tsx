import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PASSWORD_MIN } from '../../shared/phone';
import type { CountryCode, User } from '../../shared/types';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { Field, FormMessage, PhoneInput, splitPhone, PasswordInput } from '../components/FormBits';

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="container page-pad narrow">
      <p className="breadcrumb">
        {user?.role === 'admin' ? <Link to="/admin">管理后台</Link> : <Link to="/account">我的账户</Link>}
        <span aria-hidden="true">›</span>
        <span>个人资料</span>
      </p>
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}

function ProfileForm() {
  const { user, setUser } = useAuth();
  const initialPhone = splitPhone(user!.phone);
  const [form, setForm] = useState({
    name: user!.name,
    countryCode: initialPhone.countryCode as CountryCode,
    phone: initialPhone.local,
    email: user!.email ?? '',
    wechat: user!.wechat,
    company: user!.company,
  });
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMsg({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ user: User }>('/auth/profile', { method: 'PUT', body: form });
      setUser(r.user);
      setMsg({ success: '资料已保存' });
    } catch (err) {
      setMsg({ error: err instanceof ApiError ? err.message : '保存失败，请稍后再试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit} noValidate>
      <h1 className="sub-title first">个人资料</h1>
      <Field label="姓名 *">
        <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} />
      </Field>
      <Field label="手机号" hint="手机号和邮箱至少保留一项，均可用于登录">
        <PhoneInput countryCode={form.countryCode} phone={form.phone} onCountryCode={set('countryCode')} onPhone={set('phone')} />
      </Field>
      <Field label="邮箱">
        <input className="input" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="微信号">
          <input className="input" value={form.wechat} onChange={(e) => set('wechat')(e.target.value)} />
        </Field>
        <Field label="公司名称">
          <input className="input" value={form.company} onChange={(e) => set('company')(e.target.value)} />
        </Field>
      </div>
      <FormMessage {...msg} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? '保存中…' : '保存资料'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < PASSWORD_MIN) return setMsg({ error: `新密码至少需要 ${PASSWORD_MIN} 位` });
    if (next !== confirm) return setMsg({ error: '两次输入的新密码不一致' });
    setBusy(true);
    try {
      await api('/auth/password', { method: 'PUT', body: { current, next } });
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ success: '密码已修改，其他设备上的登录已退出' });
    } catch (err) {
      setMsg({ error: err instanceof ApiError ? err.message : '修改失败，请稍后再试' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form-card" onSubmit={submit} noValidate>
      <h2 className="sub-title first">修改密码</h2>
      <Field label="当前密码">
        <PasswordInput autoComplete="current-password" value={current} onChange={setCurrent} />
      </Field>
      <Field label="新密码" hint={`至少 ${PASSWORD_MIN} 位`}>
        <PasswordInput autoComplete="new-password" value={next} onChange={setNext} />
      </Field>
      <Field label="确认新密码">
        <PasswordInput autoComplete="new-password" value={confirm} onChange={setConfirm} />
      </Field>
      <FormMessage {...msg} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? '提交中…' : '修改密码'}
      </button>
    </form>
  );
}
