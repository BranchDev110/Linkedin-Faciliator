import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser } from '../lib/auth-routes';
import { isAuthPath } from '../lib/auth-session';

export default function AuthNavigationSync() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user || !isAuthPath(location.pathname)) {
      return;
    }

    const fromExtension = new URLSearchParams(location.search).get('source') === 'extension';
    navigate(getHomePathForUser(user, fromExtension), { replace: true });
  }, [user, loading, location.pathname, location.search, navigate]);

  return null;
}
