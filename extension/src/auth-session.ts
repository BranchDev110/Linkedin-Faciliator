import { validateAuthToken } from './auth-validation';
import { WEB_URL } from './config';
import {
  ExtensionContextError,
  isExtensionContextValid,
} from './extension-runtime';
import { storageGet, storageRemove, storageSet } from './extension-storage';

export const AUTH_UID_KEY = 'authUid';
export const SIGNED_OUT_KEY = 'signedOut';

export interface ExtensionAuthStorage {
  token?: string;
  email?: string;
  authUid?: string;
  signedOut?: boolean;
  lastApplicationId?: string;
}

export async function markSignedOut(): Promise<void> {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  await storageSet({ [SIGNED_OUT_KEY]: true });
}

export async function clearAuthStorage(): Promise<void> {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  await storageRemove(['token', 'email', AUTH_UID_KEY, 'lastApplicationId']);
  await markSignedOut();
}

export async function persistAuthSession(
  token: string,
  email = '',
): Promise<{ token: string; email: string } | null> {
  if (!token?.trim()) return null;

  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  const existing = await storageGet<ExtensionAuthStorage>([
    'token',
    'email',
    AUTH_UID_KEY,
    SIGNED_OUT_KEY,
  ]);

  const validation = await validateAuthToken(token);

  if (validation.status === 'invalid') {
    return null;
  }

  if (validation.status === 'unavailable') {
    if (existing.token === token && existing.signedOut !== true) {
      return {
        token: existing.token,
        email: existing.email || email,
      };
    }

    return null;
  }

  const nextEmail = validation.session.email || email;
  const unchanged =
    existing.token === validation.session.token &&
    existing.email === nextEmail &&
    existing.authUid === validation.session.uid &&
    existing.signedOut !== true;

  if (!unchanged) {
    await storageSet({
      token: validation.session.token,
      email: nextEmail,
      [AUTH_UID_KEY]: validation.session.uid,
      [SIGNED_OUT_KEY]: false,
    });
  }

  return {
    token: validation.session.token,
    email: nextEmail,
  };
}

export function isAppWebUrl(url?: string): boolean {
  if (!url) return false;

  const normalized = url.toLowerCase();

  try {
    const configuredHost = new URL(WEB_URL).host.toLowerCase();
    if (configuredHost && normalized.includes(configuredHost)) {
      return true;
    }
  } catch {
    // ignore invalid WEB_URL at build time
  }

  return (
    normalized.includes('localhost:5173') ||
    normalized.includes('localhost:3001') ||
    normalized.includes('localhost:3002') ||
    normalized.includes('ngrok-free.app') ||
    normalized.includes('ngrok-free.dev') ||
    normalized.includes('ngrok.io')
  );
}
