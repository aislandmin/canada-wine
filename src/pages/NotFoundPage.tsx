import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container empty page-pad">
      <h1 className="section-title">页面不存在</h1>
      <Link to="/" className="btn btn-ghost">
        返回首页
      </Link>
    </div>
  );
}
