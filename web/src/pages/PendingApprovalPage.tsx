import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser } from '../lib/auth-routes';
import './PendingApprovalPage.css';

export default function PendingApprovalPage() {
  const navigate = useNavigate();
  const { user, logout, isApproved, isAdmin } = useAuth();

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (user && (isApproved || isAdmin)) {
    return <Navigate to={getHomePathForUser(user)} replace />;
  }

  const isRejected = user?.status === 'rejected';

  return (
    <div className="pending-page">
      <div className="pending-card">
        <h1>{isRejected ? 'Account not approved' : 'Waiting for approval'}</h1>
        <p>
          {isRejected
            ? 'Your account request was rejected by an administrator. Contact support if you believe this is a mistake.'
            : 'You can sign in, but your account is pending admin approval. You will get full access once an administrator approves your account.'}
        </p>
        <p className="pending-email">{user?.email}</p>
        <button type="button" className="btn btn-secondary" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
