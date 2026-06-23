export const TOKEN_KEY = 'li_facilitator_token';
export const EMAIL_KEY = 'li_facilitator_email';
export const SIGNED_OUT_KEY = 'li_facilitator_signed_out';

export function isSignedOutFlagSet(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function hasStoredAuthToken(): boolean {
  try {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  } catch {
    return false;
  }
}

export function shouldRestoreStoredSession(): boolean {
  if (!hasStoredAuthToken()) {
    return false;
  }

  if (isSignedOutFlagSet()) {
    try {
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      // ignore
    }
  }

  return true;
}

export function isAuthPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '');
  return normalized === '/login' || normalized === '/signup' || normalized === '/auth';
}
