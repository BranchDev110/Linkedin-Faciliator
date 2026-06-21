import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { apiRequest } from '../lib/api';

interface AuthUser {
  uid: string;
  email: string;
  name?: string;
  emailVerified?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => void;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_SYNC_EVENT = 'li-facilitator-auth-sync';
const AUTH_FROM_EXTENSION_EVENT = 'li-facilitator-auth-from-extension';
const AUTH_CLEAR_EVENT = 'li-facilitator-auth-clear';
const TOKEN_KEY = 'li_facilitator_token';
const EMAIL_KEY = 'li_facilitator_email';

function syncExtensionSession(user: AuthUser, accessToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(EMAIL_KEY, user.email || '');
  window.postMessage(
    { type: 'LI_FACILITATOR_AUTH', token: accessToken, email: user.email || '' },
    window.location.origin,
  );
  window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
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

  const restoreSession = useCallback(async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setToken(null);
      setUser(null);
      return false;
    }

    setToken(storedToken);

    try {
      const { user: currentUser } = await apiRequest<{ user: AuthUser | null }>(
        '/auth/me',
        { token: storedToken },
      );

      if (!currentUser) {
        clearExtensionSession();
        setToken(null);
        setUser(null);
        return false;
      }

      setUser(currentUser);
      syncExtensionSession(currentUser, storedToken);
      return true;
    } catch (error) {
      if (isAuthError(error)) {
        clearExtensionSession();
        setToken(null);
        setUser(null);
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);

      let restored = await restoreSession();
      if (!restored && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!cancelled && localStorage.getItem(TOKEN_KEY)) {
          restored = await restoreSession();
        }
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    void bootstrap();

    const onAuthUpdated = () => {
      if (!cancelled) {
        void bootstrap();
      }
    };

    window.addEventListener(AUTH_FROM_EXTENSION_EVENT, onAuthUpdated);
    window.addEventListener(AUTH_SYNC_EVENT, onAuthUpdated);

    (window as Window & {
      __liFacilitatorGetFreshToken?: () => Promise<string | null>;
    }).__liFacilitatorGetFreshToken = async () => localStorage.getItem(TOKEN_KEY);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_FROM_EXTENSION_EVENT, onAuthUpdated);
      window.removeEventListener(AUTH_SYNC_EVENT, onAuthUpdated);
      delete (window as Window & {
        __liFacilitatorGetFreshToken?: () => Promise<string | null>;
      }).__liFacilitatorGetFreshToken;
    };
  }, [restoreSession]);

  const getIdToken = async (): Promise<string | null> => {
    return localStorage.getItem(TOKEN_KEY);
  };

  const signIn = async (email: string, password: string) => {
    const response = await apiRequest<{ accessToken: string; user: AuthUser }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    setToken(response.accessToken);
    setUser(response.user);
    syncExtensionSession(response.user, response.accessToken);
  };

  const signUp = async (email: string, password: string) => {
    const response = await apiRequest<{ accessToken: string; user: AuthUser }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );

    setToken(response.accessToken);
    setUser(response.user);
    syncExtensionSession(response.user, response.accessToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    clearExtensionSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signUp,
        logout,
        getIdToken,
      }}
    >
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
