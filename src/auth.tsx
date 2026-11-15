import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../shared/types';
import { api } from './api';

interface AuthState {
  user: User | null;
  /** True until the first /auth/me check completes. */
  checking: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api<{ user: User | null }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, checking, setUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Renders children only for logged-in users; otherwise sends them to /login and back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <p className="container muted center page-pad">加载中…</p>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

/** Buyer-only pages (my account). Admins are sent to the back office instead. */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <RequireAuth>{user?.role === 'admin' ? <Navigate to="/admin" replace /> : children}</RequireAuth>;
}

/** Admin-only pages. Non-admins see a "no permission" message. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <RequireAuth>
      {user?.role === 'admin' ? children : <p className="container center page-pad">没有权限访问此页面。</p>}
    </RequireAuth>
  );
}

/** Where to go after login: home page for the role, unless a safe same-site `next` was requested. */
export function homeFor(user: User): string {
  return user.role === 'admin' ? '/admin' : '/account';
}

/** Only allow same-site relative paths as a post-login redirect target. */
export function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}
