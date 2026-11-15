import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import SummaryView from '../components/SummaryView';

export default function AccountPage() {
  const { user } = useAuth();
  return (
    <div className="container page-pad">
      <div className="account-head">
        <div>
          <h1 className="section-title">您好，{user!.name}</h1>
          <p className="muted small">您的累计消费与可享折扣</p>
        </div>
        <Link to="/account/profile" className="btn btn-ghost">
          个人资料 / 修改密码
        </Link>
      </div>
      <SummaryView audience="customer" path={(asOf) => `/account/summary?asOf=${asOf}`} />
    </div>
  );
}
