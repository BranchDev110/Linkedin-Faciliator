import { useAuth } from '../context/AuthContext';

export function useAuthScope() {
  const { user, token } = useAuth();

  return {
    userId: user?.uid ?? null,
    token,
    user,
  };
}
