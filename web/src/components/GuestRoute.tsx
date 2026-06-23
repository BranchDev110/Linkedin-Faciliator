import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser } from '../lib/auth-routes';
import { shouldRestoreStoredSession } from '../lib/auth-session';

export default function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const fromExtension = searchParams.get('source') === 'extension';
  const restoringSession = !user && shouldRestoreStoredSession();

  if (loading || restoringSession) {
    return <div className="loading">Loading...</div>;
  }

  if (user) {
    return <Navigate to={getHomePathForUser(user, fromExtension)} replace />;
  }

  return <>{children}</>;
}
