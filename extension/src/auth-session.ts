import { validateAuthToken } from './auth-validation';
import {
  ExtensionContextError,
  isExtensionContextError,
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
  const validated = await validateAuthToken(token);
  if (!validated) return null;

  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  const existing = await storageGet<ExtensionAuthStorage>([
    'token',
    'email',
    AUTH_UID_KEY,
    SIGNED_OUT_KEY,
  ]);

  const nextEmail = validated.email || email;
  const unchanged =
    existing.token === validated.token &&
    existing.email === nextEmail &&
    existing.authUid === validated.uid &&
    existing.signedOut !== true;

  if (!unchanged) {
    await storageSet({
      token: validated.token,
      email: nextEmail,
      [AUTH_UID_KEY]: validated.uid,
      [SIGNED_OUT_KEY]: false,
    });
  }

  return {
    token: validated.token,
    email: nextEmail,
  };
}

export function isAppWebUrl(url?: string): boolean {
  if (!url) return false;

  const normalized = url.toLowerCase();
  return (
    normalized.includes('localhost:5173') ||
    normalized.includes('localhost:3001') ||
    normalized.includes('localhost:3002') ||
    normalized.includes('ngrok-free.app') ||
    normalized.includes('ngrok-free.dev') ||
    normalized.includes('ngrok.io')
  );
}
