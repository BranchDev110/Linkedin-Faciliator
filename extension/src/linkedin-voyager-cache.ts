import { extractApplyUrlFromVoyagerPayload } from './linkedin-voyager';

export const VOYAGER_JOB_POSTING_EVENT = 'li-facilitator-voyager-job-posting';

const applyUrlByJobId = new Map<string, string>();

export function ingestVoyagerJobPostingPayload(jobId: string, payload: unknown): string {
  if (!jobId || !/^\d+$/.test(jobId)) return '';

  const url = extractApplyUrlFromVoyagerPayload(payload);
  if (url) applyUrlByJobId.set(jobId, url);
  return url;
}

export function getCachedCompanyApplyUrl(jobId: string): string {
  if (!jobId) return '';
  return applyUrlByJobId.get(jobId) || '';
}

export function setCachedCompanyApplyUrl(jobId: string, url: string): void {
  if (!jobId || !url || !/^\d+$/.test(jobId)) return;
  applyUrlByJobId.set(jobId, url);
}

/** Give LinkedIn's own Voyager request time to populate the hook cache. */
export async function waitForCachedApplyUrl(
  jobId: string,
  maxWaitMs = 1000,
): Promise<string> {
  const cached = getCachedCompanyApplyUrl(jobId);
  if (cached) return cached;

  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const next = getCachedCompanyApplyUrl(jobId);
    if (next) return next;
  }

  return '';
}

export function bindVoyagerJobPostingListener(): void {
  window.addEventListener(VOYAGER_JOB_POSTING_EVENT, (event) => {
    const detail = (event as CustomEvent<{ jobId?: string; payload?: unknown }>).detail;
    if (!detail?.jobId || detail.payload === undefined) return;
    ingestVoyagerJobPostingPayload(detail.jobId, detail.payload);
  });
}
