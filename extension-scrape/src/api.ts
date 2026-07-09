import { API_ENDPOINT, CHECK_API_ENDPOINT } from './config';

export interface ScrapePayload {
  sender: string;
  companyName: string;
  companyIcon?: string;
  jobTitle: string;
  jobDescription: string;
  jobLink: string;
  source: string;
  postedAt?: string;
  jobID?: string;
}

export interface ScrapeResponse {
  success?: boolean;
  created?: boolean;
  duplicate?: boolean;
  id?: string;
  jobLink?: string;
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

  if (API_ENDPOINT.includes('ngrok')) {
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

export async function sendJobToScrapeApi(payload: ScrapePayload): Promise<{
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
