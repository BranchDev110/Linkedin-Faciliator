import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ApprovedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isApproved, isAdmin } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === 'rejected') {
    return <Navigate to="/pending" replace />;
  }

  if (!isApproved && !isAdmin) {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}
