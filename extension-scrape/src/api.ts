import { API_BASE_URL, API_ENDPOINT, CHECK_API_ENDPOINT } from './config';

export interface IngestCompany {
  name: string;
  logo: string;
  tags: string[];
}

export interface IngestApplicants {
  count: number;
  text: string;
}

export interface IngestJobDetails {
  location: string;
}

export interface IngestJob {
  title: string;
  company: IngestCompany;
  description: string;
  applyLink: string;
  companyLink: string;
  postedAgo: string;
  tags: string[];
  skills: string[];
  details: IngestJobDetails;
  applicants?: IngestApplicants;
  id?: string;
  scrapeFrom: string;
}

export interface IngestPayload {
  createdBy: string;
  jobs: IngestJob[];
}

export interface ScrapeResponse {
  success?: boolean;
  created?: boolean | number;
  inserted?: number;
  duplicate?: boolean;
  duplicates?: number;
  id?: string;
  message?: string;
  error?: string;
}

export interface CheckJobResponse {
  success?: boolean;
  exists?: boolean;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (API_BASE_URL.includes('ngrok') || API_ENDPOINT.includes('ngrok')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  return headers;
}

export function formatJobId(linkedInJobId?: string): string | null {
  const id = linkedInJobId?.trim();
  if (!id || !/^\d+$/.test(id)) {
    return null;
  }

  return `linkedin-${id}`;
}

// Currently unused: the "already recorded" check is disabled in src/sidebar.ts
// because /api/jobs/check is not working. Kept so the lookup can be restored.
export async function checkJobExists(jobID: string): Promise<CheckJobResponse | null> {
  const response = await fetch(CHECK_API_ENDPOINT, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ jobID }),
  });

  try {
    return (await response.json()) as CheckJobResponse;
  } catch {
    return null;
  }
}

export async function sendJobToScrapeApi(payload: IngestPayload): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  body: ScrapeResponse | null;
}> {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  let body: ScrapeResponse | null = null;
  try {
    body = (await response.json()) as ScrapeResponse;
  } catch {
    body = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  };
}
