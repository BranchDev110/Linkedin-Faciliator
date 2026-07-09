export interface ProxyFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  bodyText?: string;
  bodyBase64?: string;
  contentType?: string;
  error?: string;
}

/** Sidebar/popup pages route through the background worker (bypasses CORS + mixed content). */
export function needsBackgroundApiProxy(): boolean {
  return typeof document !== 'undefined';
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function proxyResultToResponse(result: ProxyFetchResult): Response {
  if (result.error) {
    throw new Error(result.error);
  }

  const headers = new Headers();
  if (result.contentType) {
    headers.set('content-type', result.contentType);
  }

  const body = result.bodyBase64
    ? base64ToArrayBuffer(result.bodyBase64)
    : result.bodyText ?? '';

  return new Response(body, {
    status: result.status,
    statusText: result.statusText,
    headers,
  });
}

export interface ApiFetchInit extends RequestInit {
  binary?: boolean;
}

export async function proxyFetchThroughBackground(
  url: string,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { binary = false, ...fetchInit } = init;
  const body = typeof fetchInit.body === 'string' ? fetchInit.body : undefined;

  const result = (await chrome.runtime.sendMessage({
    type: 'PROXY_FETCH',
    url,
    method: fetchInit.method || 'GET',
    headers: headersToRecord(fetchInit.headers),
    body,
    binary,
  })) as ProxyFetchResult | undefined;

  if (!result) {
    throw new Error('Extension background unavailable');
  }

  return proxyResultToResponse(result);
}

export async function apiFetch(url: string, init: ApiFetchInit = {}): Promise<Response> {
  if (needsBackgroundApiProxy()) {
    return proxyFetchThroughBackground(url, init);
  }

  const { binary: _binary, ...fetchInit } = init;
  return fetch(url, fetchInit);
}
