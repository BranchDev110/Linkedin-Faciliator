import { SENDER, API_ENDPOINT } from './config';
import type { ExtractedJob } from './extract-job';

interface ScrapeResponse {
  success?: boolean;
  created?: boolean;
  duplicate?: boolean;
  id?: string;
  jobLink?: string;
  error?: string;
}

const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const jobPanel = document.getElementById('job-panel') as HTMLDivElement;
const jobTitleEl = document.getElementById('job-title') as HTMLHeadingElement;
const jobCompanyEl = document.getElementById('job-company') as HTMLParagraphElement;
const companyAvatarEl = document.getElementById('company-avatar') as HTMLDivElement;
const jobLinkEl = document.getElementById('job-link') as HTMLAnchorElement;
const jdTextEl = document.getElementById('jd-text') as HTMLTextAreaElement;
const btnSend = document.getElementById('btn-send') as HTMLButtonElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;

let currentJob: ExtractedJob | null = null;
let submitting = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentJobKey = '';
const sentJobKeys = new Set<string>();

function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function jobKey(job: ExtractedJob): string {
  return (
    job.linkedInJobId?.trim() ||
    job.linkedInJobUrl?.trim() ||
    job.jobUrl?.trim() ||
    `${job.jobTitle}|${job.companyName}`
  );
}

function setJobLink(href: string | undefined): void {
  if (!href) {
    jobLinkEl.classList.add('hidden');
    jobLinkEl.removeAttribute('href');
    return;
  }
  jobLinkEl.href = href;
  jobLinkEl.textContent = href;
  jobLinkEl.title = href;
  jobLinkEl.classList.remove('hidden');
}

function setCompanyAvatar(logoUrl: string | undefined, companyName: string): void {
  const initial = (companyName?.trim()?.charAt(0) || '?').toUpperCase();
  if (logoUrl && /^https?:\/\//.test(logoUrl)) {
    companyAvatarEl.textContent = '';
    companyAvatarEl.style.backgroundImage = `url("${logoUrl.replace(/"/g, '%22')}")`;
    companyAvatarEl.classList.add('has-logo');
  } else {
    companyAvatarEl.style.backgroundImage = '';
    companyAvatarEl.classList.remove('has-logo');
    companyAvatarEl.textContent = initial;
  }
}

function showToast(message: string, kind: 'success' | 'error'): void {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'success', 'error');
  toastEl.classList.add(kind);
  toastEl.classList.remove('hidden');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 4000);
}

function showError(message: string): void {
  showToast(message, 'error');
}

function canSend(): boolean {
  if (!currentJob) return false;
  if (submitting) return false;
  const description = currentJob.jobDescription?.trim() || '';
  if (description.length === 0) return false;
  const jobLink = currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  if (!/^https?:\/\//.test(jobLink)) return false;
  if (currentJobKey && sentJobKeys.has(currentJobKey)) return false;
  return true;
}

function updateSendButton(): void {
  if (submitting) {
    btnSend.disabled = true;
    btnSend.textContent = 'Sending…';
    return;
  }
  if (currentJobKey && sentJobKeys.has(currentJobKey)) {
    btnSend.disabled = true;
    btnSend.textContent = 'Scrape';
    return;
  }
  btnSend.disabled = !canSend();
  btnSend.textContent = 'Scrape';
}

function render(): void {
  if (!currentJob) {
    emptyState.classList.remove('hidden');
    jobPanel.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  jobPanel.classList.remove('hidden');

  jobTitleEl.textContent = currentJob.jobTitle || 'Untitled position';
  jobCompanyEl.textContent = currentJob.companyName || 'Unknown company';

  setCompanyAvatar(currentJob.companyLogoUrl, currentJob.companyName || '');
  setJobLink(currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim());

  jdTextEl.value = currentJob.jobDescription || '';

  updateSendButton();
}

function setJob(job: ExtractedJob): void {
  const nextKey = jobKey(job);
  // Different job (or first time) — reset per-job sent state.
  if (nextKey !== currentJobKey) {
    currentJobKey = nextKey;
  }
  currentJob = job;
  render();

  try {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEBAR' }).catch(() => {});
  } catch {
    // Extension context may be unavailable.
  }
}

interface IncomingJobMessage {
  type?: string;
  job?: ExtractedJob;
}

function setupJobListener(): void {
  if (!isExtensionContextValid()) return;

  try {
    chrome.runtime.onMessage.addListener((rawMessage: unknown) => {
      const message = rawMessage as IncomingJobMessage;
      if ((message?.type === 'JOB_DETECTED' || message?.type === 'EXTRACT_JOB') && message.job) {
        setJob(message.job);
      }
    });
  } catch {
    // Extension context may have become invalid; ignore.
  }
}

async function sendToApi(): Promise<void> {
  if (!currentJob || submitting) return;
  if (currentJobKey && sentJobKeys.has(currentJobKey)) return;

  const jobLink =
    currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  const description = currentJob.jobDescription?.trim() || '';

  if (!description) {
    showError('No job description to send yet.');
    return;
  }
  if (!/^https?:\/\//.test(jobLink)) {
    showError('Job link is missing — cannot send.');
    return;
  }

  const payload = {
    sender: SENDER,
    companyName: currentJob.companyName || '',
    companyIcon: currentJob.companyLogoUrl || undefined,
    jobTitle: currentJob.jobTitle || '',
    jobDescription: description,
    jobLink,
    source: 'linkedin',
  };

  submitting = true;
  updateSendButton();

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    let body: ScrapeResponse | null = null;
    try {
      body = (await response.json()) as ScrapeResponse;
    } catch {
      body = null;
    }

    if (response.ok && body?.success !== false) {
      if (currentJobKey) sentJobKeys.add(currentJobKey);
      if (body?.duplicate) {
        showToast('Already in catalog — duplicate detected.', 'success');
      } else if (body?.created) {
        showToast('Sent to server.', 'success');
      } else {
        showToast('Server accepted the request.', 'success');
      }
    } else {
      const message =
        body?.error || `Server responded with ${response.status} ${response.statusText}`;
      showError(message);
    }
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Unknown network error';
    showError(`Network error: ${reason}`);
  } finally {
    submitting = false;
    updateSendButton();
  }
}

function setupSendButton(): void {
  btnSend.addEventListener('click', () => {
    void sendToApi();
  });
}

setupSendButton();
setupJobListener();
render();