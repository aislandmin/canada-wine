import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useSettings } from '../settings';

export default function Layout() {
  const { siteTitle, contactText } = useSettings();
  const { user, checking, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand" onClick={close}>
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M13 2h6v8c0 2 4 4 4 9v11H9V19c0-5 4-7 4-9z" />
            </svg>
            <span>{siteTitle}</span>
          </Link>
          <button
            className="menu-toggle"
            aria-label="菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className={`site-nav${menuOpen ? ' open' : ''}`}>
            <NavLink to="/" end onClick={close}>
              全部产品
            </NavLink>
            <NavLink to="/discount" onClick={close}>
              折扣政策
            </NavLink>
            {checking ? null : user ? (
              <>
                {/* Admins are the seller: they get the back office, not a buyer's account page. */}
                {user.role === 'admin' ? (
                  <>
                    <NavLink to="/admin" onClick={close} className={({ isActive }) => `nav-account${isActive ? ' active' : ''}`}>
                      管理后台
                    </NavLink>
                    <NavLink to="/account/profile" onClick={close}>
                      个人资料
                    </NavLink>
                  </>
                ) : (
                  <NavLink to="/account" end onClick={close} className={({ isActive }) => `nav-account${isActive ? ' active' : ''}`}>
                    我的账户
                  </NavLink>
                )}
                <button
                  className="nav-button"
                  onClick={async () => {
                    close();
                    await logout();
                    navigate('/');
                  }}
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={close}>
                  登录
                </NavLink>
                <NavLink to="/signup" onClick={close} className={({ isActive }) => `nav-cta${isActive ? ' active' : ''}`}>
                  注册
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p>{contactText}</p>
          <p className="muted">价格以最新报价为准</p>
          <p className="muted">© {new Date().getFullYear()} {siteTitle}</p>
        </div>
      </footer>
    </div>
  );
}
