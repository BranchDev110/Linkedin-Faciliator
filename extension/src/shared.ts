import { API_URL, WEB_URL } from './config';
import { resolveApiUrl, validateAuthToken } from './auth-validation';
import {
  AUTH_UID_KEY,
  clearAuthStorage,
  ExtensionAuthStorage,
  markSignedOut,
  persistAuthSession,
  SIGNED_OUT_KEY,
} from './auth-session';
import {
  ExtensionContextError,
  isExtensionContextError,
  isExtensionContextValid,
  installExtensionErrorHandlers,
} from './extension-runtime';
import { storageGet, storageRemove, storageSet } from './extension-storage';

export {
  ExtensionContextError,
  isExtensionContextError,
  isExtensionContextValid,
  installExtensionErrorHandlers,
  requestSidebarReload,
} from './extension-runtime';
export { storageRemove } from './extension-storage';

const TOKEN_KEY = 'li_facilitator_token';
const EMAIL_KEY = 'li_facilitator_email';

interface StorageData {
  token?: string;
  email?: string;
  authUid?: string;
  signedOut?: boolean;
  lastApplicationId?: string;
}

export async function getStorage(): Promise<StorageData> {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  return storageGet<StorageData>([
    'token',
    'email',
    AUTH_UID_KEY,
    SIGNED_OUT_KEY,
    'lastApplicationId',
  ]);
}

export async function setStorage(data: Partial<StorageData>) {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  await storageSet(data);
}

export async function clearStorage() {
  await clearAuthStorage();
}

export async function signOut(): Promise<void> {
  try {
    await markSignedOut();
    await chrome.runtime.sendMessage({ type: 'LI_FACILITATOR_SIGNOUT' });
  } catch (error) {
    if (isExtensionContextError(error)) {
      return;
    }

    try {
      await clearAuthStorage();
    } catch {
      // ignore storage failures during sign out
    }
  }
}

export function openLoginPage() {
  chrome.tabs.create({
    url: `${WEB_URL}/login?source=extension`,
  });
}

export function openSignUpPage() {
  chrome.tabs.create({
    url: `${WEB_URL}/signup?source=extension`,
  });
}

/** @deprecated Use openLoginPage */
export function openAuthPage() {
  openLoginPage();
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

export async function getValidToken(providedToken?: string): Promise<string | null> {
  if (providedToken) return providedToken;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
    if (response?.token) return response.token;
  } catch {
    // background unavailable
  }

  const storage = await getStorage();
  if (storage.signedOut) return null;
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
  const token = await getValidToken(providedToken);

  const response = await fetch(resolveApiUrl(path), {
    ...fetchOptions,
    headers: buildHeaders(token || undefined),
  });

  if (response.status === 401) {
    await clearAuthStorage();
    throw new Error(
      'Session expired. Open the LI Facilitator dashboard, sign in, then retry.',
    );
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

export function resolveApplicationId(
  application: { id?: string; _id?: string | { toString(): string } } | null | undefined,
): string | null {
  if (!application) {
    return null;
  }

  const rawId = application.id ?? application._id;
  if (typeof rawId === 'string' && rawId.trim() && rawId !== 'undefined') {
    return rawId.trim();
  }

  if (rawId && typeof rawId === 'object' && typeof rawId.toString === 'function') {
    const normalized = rawId.toString().trim();
    return normalized && normalized !== 'undefined' ? normalized : null;
  }

  return null;
}

export interface ApplicationAiCostBreakdown {
  skillExtraction?: number;
  resumeBullets?: number;
}

export interface ApplicationRecord {
  id: string;
  userId?: string;
  profileId?: string;
  jobId?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  linkedInJobId?: string;
  linkedInJobUrl?: string;
  realJobUrl?: string;
  location?: string;
  companyLogoUrl?: string;
  hardSkills?: string[];
  competencies?: string[];
  skills?: Record<string, unknown>;
  companyBullets?: { company: string; bullets: string }[];
  aiCostUsd?: number;
  aiCostBreakdown?: ApplicationAiCostBreakdown;
  resumeUrl?: string;
  status?: 'recorded' | 'extracted' | 'resume_generated' | 'applied';
}

function roundCostUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function normalizeAiCostBreakdown(
  breakdown?: ApplicationAiCostBreakdown | Record<string, number> | null,
): ApplicationAiCostBreakdown {
  if (!breakdown) {
    return {};
  }

  const normalized: ApplicationAiCostBreakdown = {};
  const skillExtraction = breakdown.skillExtraction;
  const resumeBullets = breakdown.resumeBullets;

  if (typeof skillExtraction === 'number' && skillExtraction > 0) {
    normalized.skillExtraction = roundCostUsd(skillExtraction);
  }
  if (typeof resumeBullets === 'number' && resumeBullets > 0) {
    normalized.resumeBullets = roundCostUsd(resumeBullets);
  }

  return normalized;
}

export function sumTrackedAiCostUsd(
  breakdown?: ApplicationAiCostBreakdown | Record<string, number> | null,
): number {
  const normalized = normalizeAiCostBreakdown(breakdown);
  return roundCostUsd(
    (normalized.skillExtraction ?? 0) + (normalized.resumeBullets ?? 0),
  );
}

export function normalizeApplicationRecord(
  application: ({ id?: string; _id?: string } & Record<string, unknown>) | null | undefined,
): ApplicationRecord | null {
  if (!application) {
    return null;
  }

  const id = resolveApplicationId(application);
  if (!id) {
    return null;
  }

  const aiCostBreakdown = normalizeAiCostBreakdown(
    application.aiCostBreakdown as ApplicationAiCostBreakdown | undefined,
  );

  return {
    id,
    userId: typeof application.userId === 'string' ? application.userId : undefined,
    profileId: typeof application.profileId === 'string' ? application.profileId : undefined,
    jobId: typeof application.jobId === 'string' ? application.jobId : undefined,
    companyName:
      typeof application.companyName === 'string' ? application.companyName : undefined,
    jobTitle: typeof application.jobTitle === 'string' ? application.jobTitle : undefined,
    jobDescription:
      typeof application.jobDescription === 'string' ? application.jobDescription : undefined,
    linkedInJobId:
      typeof application.linkedInJobId === 'string' ? application.linkedInJobId : undefined,
    linkedInJobUrl:
      typeof application.linkedInJobUrl === 'string' ? application.linkedInJobUrl : undefined,
    realJobUrl: typeof application.realJobUrl === 'string' ? application.realJobUrl : undefined,
    location: typeof application.location === 'string' ? application.location : undefined,
    companyLogoUrl:
      typeof application.companyLogoUrl === 'string' ? application.companyLogoUrl : undefined,
    hardSkills: Array.isArray(application.hardSkills)
      ? (application.hardSkills as string[])
      : [],
    competencies: Array.isArray(application.competencies)
      ? (application.competencies as string[])
      : [],
    skills: application.skills as Record<string, unknown> | undefined,
    companyBullets: Array.isArray(application.companyBullets)
      ? (application.companyBullets as { company: string; bullets: string }[]).map((entry) => ({
          company: String(entry.company || ''),
          bullets: String(entry.bullets || ''),
        }))
      : [],
    aiCostBreakdown,
    aiCostUsd: sumTrackedAiCostUsd(aiCostBreakdown),
    resumeUrl: typeof application.resumeUrl === 'string' ? application.resumeUrl : undefined,
    status: application.status as ApplicationRecord['status'],
  };
}

export function unwrapApplicationLookup(
  response:
    | ApplicationRecord
    | { found: boolean; application: ApplicationRecord | null }
    | Record<string, unknown>
    | null,
): ApplicationRecord | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  let application: Record<string, unknown> | null = null;
  if ('found' in response && 'application' in response) {
    application = (response.application as Record<string, unknown> | null) ?? null;
  } else {
    application = response as Record<string, unknown>;
  }

  return normalizeApplicationRecord(application);
}

export async function resolveAuthState(): Promise<StorageData | null> {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' });
    if (response?.token) {
      return response as StorageData;
    }
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw error;
    }
    // background unavailable
  }

  try {
    const storage = await getStorage();
    if (storage.signedOut || !storage.token) {
      return null;
    }

    return storage;
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw error;
    }
    return null;
  }
}

export async function ensureAuthenticatedSession(): Promise<StorageData | null> {
  let storage: StorageData;
  try {
    storage = await getStorage();
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw error;
    }
    return null;
  }

  if (storage.signedOut) {
    return null;
  }

  let auth: StorageData | null;
  try {
    auth = await resolveAuthState();
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw error;
    }
    return null;
  }

  if (!auth?.token) {
    return null;
  }

  const validated = await validateAuthToken(auth.token);
  if (!validated) {
    try {
      await clearAuthStorage();
    } catch (error) {
      if (isExtensionContextError(error)) {
        throw error;
      }
    }
    return null;
  }

  let session: { token: string; email: string } | null;
  try {
    session = await persistAuthSession(validated.token, validated.email);
  } catch (error) {
    if (isExtensionContextError(error)) {
      throw error;
    }
    return null;
  }

  if (!session) {
    try {
      await clearAuthStorage();
    } catch (error) {
      if (isExtensionContextError(error)) {
        throw error;
      }
    }
    return null;
  }

  return session;
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

export function filePathFromDownloadUrl(downloadUrl: string): string {
  try {
    const url = new URL(downloadUrl, API_URL);
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

export { WEB_URL, API_URL, TOKEN_KEY, EMAIL_KEY };
