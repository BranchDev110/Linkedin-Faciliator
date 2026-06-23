import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { apiRequest } from '../lib/api';
import {
  EMAIL_KEY,
  SIGNED_OUT_KEY,
  TOKEN_KEY,
  shouldRestoreStoredSession,
} from '../lib/auth-session';
import { AuthUser } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string) => Promise<AuthUser>;
  authenticate: (email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  getIdToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_FROM_EXTENSION_EVENT = 'li-facilitator-auth-from-extension';
const AUTH_CLEAR_EVENT = 'li-facilitator-auth-clear';

function markSignedOut() {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    // ignore
  }
}

function clearSignedOutFlag() {
  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // ignore
  }
}

function syncExtensionSession(user: AuthUser, accessToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(EMAIL_KEY, user.email || '');
  window.postMessage(
    { type: 'LI_FACILITATOR_AUTH', token: accessToken, email: user.email || '' },
    window.location.origin,
  );
}

function clearExtensionSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new CustomEvent(AUTH_CLEAR_EVENT));
}

function isAuthError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes('Session expired')
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionGenerationRef = useRef(0);
  const initialBootstrapDoneRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const authUpdateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const invalidateSession = useCallback(() => {
    sessionGenerationRef.current += 1;
    setToken(null);
    setUser(null);
    tokenRef.current = null;
  }, []);

  const restoreSession = useCallback(async () => {
    const generation = sessionGenerationRef.current;
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      if (generation === sessionGenerationRef.current) {
        setToken(null);
        setUser(null);
      }
      return false;
    }

    if (generation === sessionGenerationRef.current) {
      setToken(storedToken);
    }

    try {
      const { user: currentUser } = await apiRequest<{ user: AuthUser | null }>(
        '/auth/me',
        { token: storedToken },
      );

      if (generation !== sessionGenerationRef.current) {
        return false;
      }

      if (!currentUser) {
        clearExtensionSession();
        invalidateSession();
        return false;
      }

      setUser(currentUser);
      if (generation === sessionGenerationRef.current) {
        setToken(storedToken);
      }
      return true;
    } catch (error) {
      if (generation !== sessionGenerationRef.current) {
        return false;
      }

      if (isAuthError(error)) {
        clearExtensionSession();
        invalidateSession();
      }
      return false;
    }
  }, [invalidateSession]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(options?: { silent?: boolean }) {
      const silent = options?.silent ?? initialBootstrapDoneRef.current;
      if (!silent) {
        setLoading(true);
      }

      if (!shouldRestoreStoredSession()) {
        if (!cancelled) {
          setToken(null);
          setUser(null);
          setLoading(false);
          initialBootstrapDoneRef.current = true;
        }
        return;
      }

      let restored = await restoreSession();
      if (!restored && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!cancelled && localStorage.getItem(TOKEN_KEY)) {
          restored = await restoreSession();
        }
      }

      if (!cancelled) {
        setLoading(false);
        initialBootstrapDoneRef.current = true;
      }
    }

    void bootstrap();

    const onAuthUpdated = () => {
      if (cancelled) return;

      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        onAuthClear();
        return;
      }

      if (storedToken === tokenRef.current) {
        return;
      }

      if (authUpdateTimerRef.current) {
        window.clearTimeout(authUpdateTimerRef.current);
      }

      authUpdateTimerRef.current = window.setTimeout(() => {
        void bootstrap({ silent: true });
      }, 150);
    };

    const onAuthClear = () => {
      if (cancelled) return;
      markSignedOut();
      invalidateSession();
      setLoading(false);
    };

    window.addEventListener(AUTH_FROM_EXTENSION_EVENT, onAuthUpdated);
    window.addEventListener(AUTH_CLEAR_EVENT, onAuthClear);

    (window as Window & {
      __liFacilitatorGetFreshToken?: () => Promise<string | null>;
    }).__liFacilitatorGetFreshToken = async () => localStorage.getItem(TOKEN_KEY);

    return () => {
      cancelled = true;
      if (authUpdateTimerRef.current) {
        window.clearTimeout(authUpdateTimerRef.current);
      }
      window.removeEventListener(AUTH_FROM_EXTENSION_EVENT, onAuthUpdated);
      window.removeEventListener(AUTH_CLEAR_EVENT, onAuthClear);
      delete (window as Window & {
        __liFacilitatorGetFreshToken?: () => Promise<string | null>;
      }).__liFacilitatorGetFreshToken;
    };
  }, [restoreSession, invalidateSession]);

  const getIdToken = async (): Promise<string | null> => {
    return localStorage.getItem(TOKEN_KEY);
  };

  const refreshUser = async () => {
    await restoreSession();
  };

  const completeAuth = (response: { accessToken: string; user: AuthUser }): AuthUser => {
    clearSignedOutFlag();
    sessionGenerationRef.current += 1;
    setToken(response.accessToken);
    setUser(response.user);
    tokenRef.current = response.accessToken;
    syncExtensionSession(response.user, response.accessToken);
    setLoading(false);
    initialBootstrapDoneRef.current = true;
    return response.user;
  };

  const authenticate = async (email: string, password: string): Promise<AuthUser> => {
    const response = await apiRequest<{ accessToken: string; user: AuthUser }>(
      '/auth/authenticate',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    return completeAuth(response);
  };

  const signIn = async (email: string, password: string): Promise<AuthUser> => {
    const response = await apiRequest<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    return completeAuth(response);
  };

  const signUp = async (email: string, password: string): Promise<AuthUser> => {
    const response = await apiRequest<{ accessToken: string; user: AuthUser }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    return completeAuth(response);
  };

  const logout = () => {
    markSignedOut();
    sessionGenerationRef.current += 1;
    invalidateSession();
    clearExtensionSession();
  };

  const isAdmin = user?.role === 'admin';
  const isApproved = user?.status === 'approved';

  const value: AuthContextType = {
    user,
    token,
    loading,
    isAdmin,
    isApproved,
    signIn,
    signUp,
    authenticate,
    logout,
    getIdToken,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
