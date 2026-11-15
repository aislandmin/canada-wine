import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/admin', label: '概览', end: true },
  { to: '/admin/customers', label: '客户' },
  { to: '/admin/transactions', label: '交易记录' },
  { to: '/admin/products', label: '产品' },
  { to: '/admin/categories', label: '分类' },
  { to: '/admin/settings', label: '网站设置' },
];

export default function AdminLayout() {
  return (
    <div className="container page-pad admin">
      <nav className="admin-nav" aria-label="管理后台">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
