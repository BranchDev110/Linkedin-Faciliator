import { apiRequest } from './api';
import { normalizeApplicationResponse } from './application-lookup';
import { Application, JobRecord, Profile } from '../types';

const CACHE_TTL_MS = 30_000;

type CacheEntry<T> = {
  userId: string;
  fetchedAt: number;
  data: T;
};

let applicationsCache: CacheEntry<Application[]> | null = null;
let profileSummaryCache: CacheEntry<Profile> | null = null;

function isFresh<T>(entry: CacheEntry<T> | null, userId: string): entry is CacheEntry<T> {
  if (!entry || entry.userId !== userId) {
    return false;
  }

  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

export function invalidateApplicationsCache(): void {
  applicationsCache = null;
}

export function invalidateProfileSummaryCache(): void {
  profileSummaryCache = null;
}

export function invalidateAppDataCache(): void {
  invalidateApplicationsCache();
  invalidateProfileSummaryCache();
}

export function upsertApplicationsCache(userId: string, applications: Application[]): void {
  applicationsCache = {
    userId,
    fetchedAt: Date.now(),
    data: applications,
  };
}

export function upsertApplicationInCache(application: Application, userId: string): void {
  if (!applicationsCache || applicationsCache.userId !== userId) {
    upsertApplicationsCache(userId, [application]);
    return;
  }

  const others = applicationsCache.data.filter((entry) => entry.id !== application.id);
  applicationsCache = {
    userId,
    fetchedAt: Date.now(),
    data: [application, ...others],
  };
}

export async function fetchApplicationSummaries(
  token: string,
  userId: string,
  options?: { force?: boolean },
): Promise<Application[]> {
  if (!options?.force && isFresh(applicationsCache, userId)) {
    return applicationsCache.data;
  }

  const data = await apiRequest<unknown[]>('/applications', { token });
  const applications = data
    .map((entry) => normalizeApplicationResponse(entry))
    .filter((entry): entry is Application => entry !== null);

  applicationsCache = {
    userId,
    fetchedAt: Date.now(),
    data: applications,
  };

  return applications;
}

export async function fetchApplicationDetail(
  token: string,
  applicationId: string,
  userId: string,
): Promise<Application> {
  const application = await apiRequest<Application>(`/applications/${applicationId}`, { token });
  upsertApplicationInCache(application, userId);
  return application;
}

export async function fetchApplicationDetails(
  token: string,
  applicationIds: string[],
  userId: string,
): Promise<Application[]> {
  const uniqueIds = [...new Set(applicationIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return [];
  }

  const applications = await Promise.all(
    uniqueIds.map((applicationId) =>
      fetchApplicationDetail(token, applicationId, userId),
    ),
  );

  return applications;
}

export function applicationNeedsDetail(application: Application): boolean {
  return !application.jobDescription && !application.skills;
}

export async function fetchProfileSummary(
  token: string,
  userId: string,
  options?: { force?: boolean },
): Promise<Profile> {
  if (!options?.force && isFresh(profileSummaryCache, userId)) {
    return profileSummaryCache.data;
  }

  const profile = await apiRequest<Profile>('/profiles/me/summary', { token });
  profileSummaryCache = {
    userId,
    fetchedAt: Date.now(),
    data: profile,
  };

  return profile;
}

export async function fetchJobSummaries(token: string): Promise<JobRecord[]> {
  return apiRequest<JobRecord[]>('/jobs', { token });
}

const jobDetailCache = new Map<string, JobRecord>();

export function getCachedJobDetail(jobId: string): JobRecord | undefined {
  return jobDetailCache.get(jobId);
}

export function cacheJobDetail(job: JobRecord): JobRecord {
  if (job.id) {
    jobDetailCache.set(job.id, job);
  }
  return job;
}

export function invalidateJobDetailCache(jobId: string): void {
  if (jobId) {
    jobDetailCache.delete(jobId);
  }
}

export async function fetchJobDetail(
  token: string,
  jobId: string,
  options?: { force?: boolean },
): Promise<JobRecord> {
  if (!options?.force) {
    const cached = jobDetailCache.get(jobId);
    if (cached?.jobDescription || cached?.skills) {
      return cached;
    }
  }

  const job = await apiRequest<JobRecord>(`/jobs/record/${encodeURIComponent(jobId)}`, {
    token,
  });

  return cacheJobDetail(job);
}

export async function fetchJobDetails(token: string, jobIds: string[]): Promise<JobRecord[]> {
  const uniqueIds = [...new Set(jobIds.filter(Boolean))];
  const jobs = await Promise.all(uniqueIds.map((jobId) => fetchJobDetail(token, jobId)));
  return jobs;
}

export function mergeJobWithDetail(
  summary: JobRecord,
  detail: JobRecord | undefined,
): JobRecord {
  if (!detail) {
    return summary;
  }

  return {
    ...summary,
    ...detail,
    id: summary.id || detail.id,
    linkedInJobId: summary.linkedInJobId || detail.linkedInJobId,
  };
}
