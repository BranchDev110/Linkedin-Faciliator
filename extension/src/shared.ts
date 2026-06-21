import { API_URL, WEB_URL } from './config';
import { resolveApiUrl, validateAuthToken } from './auth-validation';

const TOKEN_KEY = 'li_facilitator_token';
const EMAIL_KEY = 'li_facilitator_email';

interface StorageData {
  token?: string;
  email?: string;
  lastApplicationId?: string;
}

export async function getStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['token', 'email', 'lastApplicationId'], (result) => {
      resolve(result as StorageData);
    });
  });
}

export async function setStorage(data: Partial<StorageData>) {
  return new Promise<void>((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

export async function clearStorage() {
  return new Promise<void>((resolve) => {
    chrome.storage.local.remove(['token', 'email', 'lastApplicationId'], resolve);
  });
}

export async function signOut(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'LI_FACILITATOR_SIGNOUT' });
  } catch {
    await clearStorage();
  }
}

export function openAuthPage(mode: 'signin' | 'signup') {
  chrome.tabs.create({
    url: `${WEB_URL}/auth?source=extension&mode=${mode}`,
  });
}

export function openDashboard() {
  openWebApp('/dashboard');
}

export function openWebApp(path = '/dashboard') {
  chrome.runtime.sendMessage({ type: 'OPEN_WEB_APP', path }).catch(() => {
    chrome.tabs.create({
      url: `${WEB_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
    });
  });
}

async function syncAuthFromDashboard(forceRefresh = false): Promise<StorageData | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REFRESH_AUTH_TOKEN',
      forceRefresh,
    });
    if (response?.token) {
      await setStorage({
        token: response.token,
        email: response.email || '',
      });
      return response as StorageData;
    }
  } catch {
    // background unavailable
  }
  return null;
}

export async function getValidToken(providedToken?: string): Promise<string | null> {
  if (providedToken) return providedToken;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
    if (response?.token) return response.token;
  } catch {
    // background unavailable
  }

  const storage = await getStorage();
  return storage.token || null;
}

function buildHeaders(authToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

export { resolveApiUrl, validateAuthToken };

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token: providedToken, ...fetchOptions } = options;
  let token = await getValidToken(providedToken);

  const executeRequest = async (authToken?: string) =>
    fetch(resolveApiUrl(path), {
      ...fetchOptions,
      headers: buildHeaders(authToken),
    });

  let response = await executeRequest(token || undefined);

  if (response.status === 401) {
    const synced = await syncAuthFromDashboard(true);
    if (synced?.token) {
      token = synced.token;
      response = await executeRequest(synced.token);
    }
  }

  if (response.status === 401) {
    await clearStorage();
    throw new Error(
      'Session expired. Open the LI Facilitator dashboard, sign in, then retry.',
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function resolveAuthState(): Promise<StorageData | null> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
    if (response?.token) {
      return response as StorageData;
    }
  } catch {
    // background unavailable
  }

  const storage = await getStorage();
  return storage.token ? storage : null;
}

export async function ensureAuthenticatedSession(): Promise<StorageData | null> {
  let auth = await resolveAuthState();

  if (!auth?.token) {
    auth = await syncAuthFromDashboard(true);
  }

  if (!auth?.token) {
    return null;
  }

  const validated = await validateAuthToken(auth.token);
  if (!validated) {
    await clearStorage();
    return null;
  }

  await setStorage({
    token: validated.token,
    email: validated.email,
  });

  return {
    token: validated.token,
    email: validated.email,
  };
}

export async function downloadAuthenticatedFile(
  filePath: string,
  token: string,
  fileName: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const requestUrl = resolveApiUrl(`/files/${encodeURIComponent(filePath)}`);
  if (requestUrl.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  const response = await fetch(requestUrl, { headers });
  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'resume';
  link.click();
  URL.revokeObjectURL(url);
}

export { WEB_URL, API_URL, TOKEN_KEY, EMAIL_KEY };
