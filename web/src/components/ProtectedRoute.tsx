import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { shouldRestoreStoredSession } from '../lib/auth-session';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token, loading } = useAuth();
  const restoringSession = !user && shouldRestoreStoredSession();

  if (loading || restoringSession) {
    return <div className="loading">Loading...</div>;
  }

  // Prefer in-memory auth; fall back to stored token so a brief state gap
  // after login does not bounce the user back to /login.
  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return <>{children}</>;
}
