import { Link, Outlet } from 'react-router-dom';
import { SITE } from '../data/site';

export default function Layout() {
  return (
    <div className="app">
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="brand">
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <path d="M13 2h6v8c0 2 4 4 4 9v11H9V19c0-5 4-7 4-9z" />
            </svg>
            <span>{SITE.title}</span>
          </Link>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <p className="muted">© {new Date().getFullYear()} {SITE.title}</p>
        </div>
      </footer>
    </div>
  );
}
