import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { CountryCode, User } from '../../shared/types';
import { api, ApiError } from '../api';
import { homeFor, safeNext, useAuth } from '../auth';
import { Field, FormMessage, PhoneInput, PasswordInput } from '../components/FormBits';

type Method = 'phone' | 'email';

export default function LoginPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const [method, setMethod] = useState<Method>('phone');
  const [countryCode, setCountryCode] = useState<CountryCode>('+86');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Admins land in the back office, customers on their account page (unless a page asked to return).
  if (user) return <Navigate to={next ?? homeFor(user)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api<{ user: User }>('/auth/login', {
        method: 'POST',
        body: { method, countryCode, phone, email, password },
      });
      setUser(r.user);
      navigate(next ?? homeFor(r.user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请稍后再试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page-pad auth-page">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1 className="section-title">登录</h1>

        <div className="tabs" role="tablist">
          {(['phone', 'email'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={method === m}
              className={`tab${method === m ? ' active' : ''}`}
              onClick={() => {
                setMethod(m);
                setError('');
              }}
            >
              {m === 'phone' ? '手机号登录' : '邮箱登录'}
            </button>
          ))}
        </div>

        {method === 'phone' ? (
          <Field label="手机号">
            <PhoneInput countryCode={countryCode} phone={phone} onCountryCode={setCountryCode} onPhone={setPhone} required />
          </Field>
        ) : (
          <Field label="邮箱">
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
        )}

        <Field label="密码">
          <PasswordInput
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
            required
          />
        </Field>

        <FormMessage error={error} />

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>

        <p className="auth-switch">
          还没有账号？<Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>立即注册</Link>
        </p>
        <p className="form-hint center">忘记密码请联系客服重置。</p>
      </form>
    </div>
  );
}
