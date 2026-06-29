import {
  getCachedCompanyApplyUrl,
  setCachedCompanyApplyUrl,
  waitForCachedApplyUrl,
} from './linkedin-voyager-cache';

function decodeLinkedInSafetyUrl(href: string): string {
  if (!href) return '';

  try {
    const url = new URL(href, window.location.origin);

    if (!url.hostname.includes('linkedin.com')) {
      return isExternalJobUrl(href) ? href : '';
    }

    if (
      url.pathname.includes('/safety/go') ||
      url.pathname.includes('/externalApply') ||
      url.pathname.includes('/redir/redirect')
    ) {
      const encodedTarget = url.searchParams.get('url');
      if (encodedTarget) {
        return decodeURIComponent(encodedTarget);
      }
    }

    return '';
  } catch {
    return '';
  }
}

function isExternalJobUrl(url: string): boolean {
  try {
    return !new URL(url).hostname.includes('linkedin.com');
  } catch {
    return false;
  }
}

function normalizeApplyUrl(raw: string): string {
  if (!raw) return '';

  const decoded = decodeLinkedInSafetyUrl(raw);
  if (decoded && isExternalJobUrl(decoded)) return decoded;
  if (isExternalJobUrl(raw)) return raw;

  try {
    const unescaped = decodeURIComponent(raw);
    const decodedUnescaped = decodeLinkedInSafetyUrl(unescaped);
    if (decodedUnescaped && isExternalJobUrl(decodedUnescaped)) return decodedUnescaped;
    if (isExternalJobUrl(unescaped)) return unescaped;
  } catch {
    // ignore
  }

  return '';
}

export function extractApplyUrlFromVoyagerPayload(payload: unknown): string {
  const candidates: string[] = [];

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }

    const record = node as Record<string, unknown>;

    for (const key of ['companyApplyUrl', 'applyUrl', 'externalApplyUrl'] as const) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim());
      }
    }

    if (record.applyMethod && typeof record.applyMethod === 'object') {
      walk(record.applyMethod);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') walk(value);
    }
  };

  walk(payload);

  for (const raw of candidates) {
    const normalized = normalizeApplyUrl(raw);
    if (normalized) return normalized;
  }

  return '';
}

function getCsrfTokenFromDocumentCookie(): string {
  const match = document.cookie.match(/JSESSIONID=([^;]+)/);
  if (!match?.[1]) return '';
  return match[1].replace(/^"|"$/g, '');
}

function voyagerHeaders(csrf: string): Record<string, string> {
  return {
    'csrf-token': csrf,
    accept: 'application/vnd.linkedin.normalized+json+2.1',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
  };
}

const VOYAGER_JOB_POSTINGS_ENDPOINT = (jobId: string) =>
  `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}`;

const inFlightApplyUrlRequests = new Map<string, Promise<string>>();
const fetchFailedUntil = new Map<string, number>();
const FETCH_FAILURE_COOLDOWN_MS = 60_000;

function isFetchCoolingDown(jobId: string): boolean {
  const until = fetchFailedUntil.get(jobId);
  return until !== undefined && Date.now() < until;
}

function markFetchFailed(jobId: string): void {
  fetchFailedUntil.set(jobId, Date.now() + FETCH_FAILURE_COOLDOWN_MS);
}

async function fetchApplyUrlFromVoyagerEndpoint(
  endpoint: string,
  csrf: string,
): Promise<string> {
  const response = await fetch(endpoint, {
    credentials: 'include',
    headers: voyagerHeaders(csrf),
  });

  if (!response.ok) return '';

  const payload = await response.json();
  return extractApplyUrlFromVoyagerPayload(payload);
}

async function requestApplyUrlFromBackground(jobId: string): Promise<string> {
  if (!chrome.runtime?.id) return '';

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'FETCH_VOYAGER_APPLY_URL', jobId }, (response) => {
      if (chrome.runtime.lastError) {
        resolve('');
        return;
      }

      resolve(typeof response?.url === 'string' ? response.url : '');
    });
  });
}

/** LinkedIn stores offsite apply URLs in Voyager, not in the legacy Ember DOM. */
export async function fetchCompanyApplyUrlViaVoyager(
  jobId: string,
  options: { allowFetch?: boolean } = {},
): Promise<string> {
  if (!jobId || !/^\d+$/.test(jobId)) return '';

  const cached = getCachedCompanyApplyUrl(jobId);
  if (cached) return cached;

  if (options.allowFetch === false) return '';

  if (isFetchCoolingDown(jobId)) return '';

  const inFlight = inFlightApplyUrlRequests.get(jobId);
  if (inFlight) return inFlight;

  const request = (async () => {
    const fromWait = await waitForCachedApplyUrl(jobId);
    if (fromWait) return fromWait;

    let csrf = getCsrfTokenFromDocumentCookie();
    let url = '';

    if (csrf) {
      try {
        url = await fetchApplyUrlFromVoyagerEndpoint(
          VOYAGER_JOB_POSTINGS_ENDPOINT(jobId),
          csrf,
        );
      } catch {
        // fall through to background fetch
      }
    }

    if (!url) {
      url = await requestApplyUrlFromBackground(jobId);
    }

    if (url) {
      setCachedCompanyApplyUrl(jobId, url);
    } else {
      markFetchFailed(jobId);
    }

    return url;
  })();

  inFlightApplyUrlRequests.set(jobId, request);

  try {
    return await request;
  } finally {
    inFlightApplyUrlRequests.delete(jobId);
  }
}
