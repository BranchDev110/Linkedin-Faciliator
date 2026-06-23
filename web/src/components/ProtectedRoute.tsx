import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shouldRestoreStoredSession } from '../lib/auth-session';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const restoringSession = !user && shouldRestoreStoredSession();

  if (loading || restoringSession) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
