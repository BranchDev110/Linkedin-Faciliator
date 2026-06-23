import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getHomePathForUser, redirectToHome } from '../lib/auth-routes';
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
    const nextPath = getHomePathForUser(user, fromExtension);
    navigate(nextPath, { replace: true });

    const timer = window.setTimeout(() => {
      if (isAuthPath(window.location.pathname)) {
        redirectToHome(user, fromExtension);
      }
    }, 50);

    return () => {
      window.clearTimeout(timer);
    };
  }, [user, loading, location.pathname, location.search, navigate]);

  return null;
}
