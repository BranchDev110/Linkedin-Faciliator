export const TOKEN_KEY = 'li_facilitator_token';
export const EMAIL_KEY = 'li_facilitator_email';
export const SIGNED_OUT_KEY = 'li_facilitator_signed_out';
export const EXTENSION_SYNCED_EVENT = 'li-facilitator-extension-synced';

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
  if (isSignedOutFlagSet()) {
    return false;
  }

  return hasStoredAuthToken();
}

export function isAuthPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '');
  return normalized === '/login' || normalized === '/signup' || normalized === '/auth';
}
