import {
  TOKEN_KEY,
} from './auth-session';

type TokenProvider = () => Promise<string | null>;

let tokenProvider: TokenProvider = async () => localStorage.getItem(TOKEN_KEY);

function getConfiguredApiBase(): string {
  return (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
}

function getApiHost(): string {
  const configured = getConfiguredApiBase();
  return configured.endsWith('/api') ? configured.slice(0, -4) : configured;
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const configured = getConfiguredApiBase();

  if (normalizedPath.startsWith('/auth') || normalizedPath.startsWith('/files/')) {
    return `${getApiHost()}${normalizedPath}`;
  }

  if (configured.endsWith('/api')) {
    return `${configured}${normalizedPath}`;
  }

  return `${configured}/api${normalizedPath}`;
}

export function getApiUrl(): string {
  return getConfiguredApiBase();
}

export function setTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token: explicitToken, ...fetchOptions } = options;

  let token = explicitToken;
  if (!token) {
    token = (await tokenProvider()) ?? undefined;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const requestUrl = resolveApiUrl(path);
  if (requestUrl.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(requestUrl, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Invalid response from server');
  }
}

function fileRequestHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(resolveApiUrl('/files').includes('ngrok')
      ? { 'ngrok-skip-browser-warning': 'true' }
      : {}),
  };
}

export async function fetchAuthenticatedFile(
  filePath: string,
  token: string,
): Promise<Blob> {
  const response = await fetch(resolveApiUrl(`/files/${encodeURIComponent(filePath)}`), {
    headers: fileRequestHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Failed to load file');
  }

  return response.blob();
}

export async function downloadAuthenticatedFile(
  filePath: string,
  token: string,
  fileName: string,
): Promise<void> {
  const blob = await fetchAuthenticatedFile(filePath, token);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'resume';
  link.click();
  URL.revokeObjectURL(url);
}

export function filePathFromDownloadUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl, window.location.origin);
    const match = url.pathname.match(/\/files\/(.+)$/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch {
    // Ignore malformed URLs.
  }
  return '';
}

export function fileNameFromDownloadUrl(downloadUrl: string): string {
  const filePath = filePathFromDownloadUrl(downloadUrl);
  if (!filePath) return 'resume.docx';
  return filePath.split('/').pop() || 'resume.docx';
}
