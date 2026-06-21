import { API_URL } from './config';

export interface ValidatedAuthSession {
  token: string;
  email: string;
  uid: string;
}

function buildHeaders(authToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
  };

  if (API_URL.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
}

export function resolveApiUrl(path: string): string {
  const base = API_URL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (normalizedPath.startsWith('/auth') || normalizedPath.startsWith('/files/')) {
    const root = base.endsWith('/api') ? base.slice(0, -4) : base;
    return `${root}${normalizedPath}`;
  }

  if (base.endsWith('/api')) {
    return `${base}${normalizedPath}`;
  }

  return `${base}/api${normalizedPath}`;
}

export async function validateAuthToken(
  token: string,
): Promise<ValidatedAuthSession | null> {
  if (!token?.trim()) return null;

  try {
    const response = await fetch(resolveApiUrl('/auth/me'), {
      headers: buildHeaders(token),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      user?: { uid?: string; email?: string } | null;
    };

    if (!data.user?.uid) return null;

    return {
      token,
      email: data.user.email || '',
      uid: data.user.uid,
    };
  } catch {
    return null;
  }
}
