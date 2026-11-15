import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { PASSWORD_MIN } from '../../shared/phone';
import type { CountryCode, User } from '../../shared/types';
import { api, ApiError } from '../api';
import { homeFor, safeNext, useAuth } from '../auth';
import { Field, FormMessage, PhoneInput, PasswordInput } from '../components/FormBits';

export default function SignupPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [form, setForm] = useState({
    name: '',
    countryCode: '+86' as CountryCode,
    phone: '',
    email: '',
    wechat: '',
    company: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(k: K) => (v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  if (user) return <Navigate to={next ?? homeFor(user)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('请填写姓名');
    if (!form.phone.trim() && !form.email.trim()) return setError('请填写手机号或邮箱（至少一项）');
    if (form.password.length < PASSWORD_MIN) return setError(`密码至少需要 ${PASSWORD_MIN} 位`);
    if (form.password !== form.confirm) return setError('两次输入的密码不一致');

    setBusy(true);
    try {
      const { confirm: _confirm, ...body } = form;
      const r = await api<{ user: User }>('/auth/signup', { method: 'POST', body });
      setUser(r.user);
      navigate(next ?? homeFor(r.user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '注册失败，请稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page-pad auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1 className="section-title">注册账号</h1>
        <p className="muted small">注册后可随时查看您的累计消费金额、可享折扣及全部交易记录。</p>

        <Field label="姓名 *">
          <input className="input" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </Field>
        <Field label="手机号" hint="手机号和邮箱至少填写一项，均可用于登录">
          <PhoneInput
            countryCode={form.countryCode}
            phone={form.phone}
            onCountryCode={set('countryCode')}
            onPhone={set('phone')}
          />
        </Field>
        <Field label="邮箱">
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email')(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="微信号">
            <input className="input" value={form.wechat} onChange={(e) => set('wechat')(e.target.value)} />
          </Field>
          <Field label="公司名称">
            <input
              className="input"
              autoComplete="organization"
              value={form.company}
              onChange={(e) => set('company')(e.target.value)}
            />
          </Field>
        </div>
        <Field label="密码 *" hint={`至少 ${PASSWORD_MIN} 位`}>
          <PasswordInput
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
        </Field>
        <Field label="确认密码 *">
          <PasswordInput
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
          />
        </Field>

        <FormMessage error={error} />

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '提交中…' : '注册'}
        </button>
        <p className="auth-switch">
          已有账号？<Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>直接登录</Link>
        </p>
      </form>
    </div>
  );
}
