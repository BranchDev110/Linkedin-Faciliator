import { SENDER } from './config';
import {
  checkJobExists,
  formatJobId,
  sendJobToScrapeApi,
} from './api';
import type { ExtractedJob } from './extract-job';

const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const jobPanel = document.getElementById('job-panel') as HTMLDivElement;
const jobTitleEl = document.getElementById('job-title') as HTMLHeadingElement;
const jobCompanyEl = document.getElementById('job-company') as HTMLParagraphElement;
const jobPostedAtEl = document.getElementById('job-posted-at') as HTMLSpanElement;
const jobRecordedNotice = document.getElementById('job-recorded-notice') as HTMLDivElement;
const companyAvatarEl = document.getElementById('company-avatar') as HTMLDivElement;
const jobLinkEl = document.getElementById('job-link') as HTMLAnchorElement;
const jdTextEl = document.getElementById('jd-text') as HTMLTextAreaElement;
const btnSend = document.getElementById('btn-send') as HTMLButtonElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;

let currentJob: ExtractedJob | null = null;
let submitting = false;
let checkingJob = false;
let jobExistsOnServer = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentJobKey = '';
const sentJobKeys = new Set<string>();
const jobExistsCache = new Map<string, boolean>();
const checkInFlight = new Map<string, Promise<boolean>>();

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

function isJobAlreadyHandled(): boolean {
  return jobExistsOnServer || (currentJobKey !== '' && sentJobKeys.has(currentJobKey));
}

function canSend(): boolean {
  if (!currentJob) return false;
  if (submitting || checkingJob) return false;
  if (isJobAlreadyHandled()) return false;

  const description = currentJob.jobDescription?.trim() || '';
  if (description.length === 0) return false;

  const jobLink = currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  if (!/^https?:\/\//.test(jobLink)) return false;

  return true;
}

function updateRecordedNotice(): void {
  if (checkingJob) {
    jobRecordedNotice.textContent = 'Checking if this job is already recorded…';
    jobRecordedNotice.className = 'job-recorded-notice is-checking';
    jobRecordedNotice.classList.remove('hidden');
    return;
  }

  if (jobExistsOnServer || (currentJobKey && sentJobKeys.has(currentJobKey))) {
    jobRecordedNotice.textContent = 'This job is already recorded on the server.';
    jobRecordedNotice.className = 'job-recorded-notice is-recorded';
    jobRecordedNotice.classList.remove('hidden');
    return;
  }

  jobRecordedNotice.textContent = '';
  jobRecordedNotice.classList.add('hidden');
}

function updateSendButton(): void {
  updateRecordedNotice();

  if (submitting) {
    btnSend.disabled = true;
    btnSend.textContent = 'Sending…';
    return;
  }

  if (checkingJob) {
    btnSend.disabled = true;
    btnSend.textContent = 'Checking…';
    return;
  }

  if (isJobAlreadyHandled()) {
    btnSend.disabled = true;
    btnSend.textContent = 'Already recorded';
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

  if (currentJob.postedAt) {
    jobPostedAtEl.textContent = currentJob.postedAt;
    jobPostedAtEl.classList.remove('hidden');
  } else {
    jobPostedAtEl.textContent = '';
    jobPostedAtEl.classList.add('hidden');
  }

  setCompanyAvatar(currentJob.companyLogoUrl, currentJob.companyName || '');
  setJobLink(currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim());

  jdTextEl.value = currentJob.jobDescription || '';

  updateSendButton();
}

async function refreshJobRecordedStatus(job: ExtractedJob): Promise<void> {
  const jobID = formatJobId(job.linkedInJobId);
  if (!jobID) {
    jobExistsOnServer = false;
    checkingJob = false;
    updateSendButton();
    return;
  }

  if (jobExistsCache.has(jobID)) {
    jobExistsOnServer = jobExistsCache.get(jobID)!;
    if (jobExistsOnServer && currentJobKey) {
      sentJobKeys.add(currentJobKey);
    }
    checkingJob = false;
    updateSendButton();
    return;
  }

  const inFlight = checkInFlight.get(jobID);
  if (inFlight) {
    checkingJob = true;
    updateSendButton();
    try {
      const exists = await inFlight;
      if (formatJobId(currentJob?.linkedInJobId) !== jobID) {
        return;
      }
      jobExistsOnServer = exists;
      if (exists && currentJobKey) {
        sentJobKeys.add(currentJobKey);
      }
    } finally {
      if (formatJobId(currentJob?.linkedInJobId) === jobID) {
        checkingJob = false;
        updateSendButton();
      }
    }
    return;
  }

  checkingJob = true;
  updateSendButton();

  const request = checkJobExists(jobID)
    .then((result) => {
      const exists = result?.success === true && result.exists === true;
      jobExistsCache.set(jobID, exists);
      return exists;
    })
    .catch(() => {
      jobExistsCache.set(jobID, false);
      return false;
    });

  checkInFlight.set(jobID, request);

  try {
    const exists = await request;
    if (formatJobId(currentJob?.linkedInJobId) !== jobID) {
      return;
    }
    jobExistsOnServer = exists;
    if (exists && currentJobKey) {
      sentJobKeys.add(currentJobKey);
    }
  } finally {
    checkInFlight.delete(jobID);
    if (formatJobId(currentJob?.linkedInJobId) === jobID) {
      checkingJob = false;
      updateSendButton();
    }
  }
}

function setJob(job: ExtractedJob): void {
  const nextKey = jobKey(job);
  const sameJob = nextKey === currentJobKey;

  if (!sameJob) {
    currentJobKey = nextKey;
    jobExistsOnServer = false;
  }

  currentJob = job;
  render();

  if (!sameJob) {
    void refreshJobRecordedStatus(job);
  } else {
    const jobID = formatJobId(job.linkedInJobId);
    if (jobID && jobExistsCache.has(jobID)) {
      jobExistsOnServer = jobExistsCache.get(jobID)!;
      updateSendButton();
    }
  }

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
  if (!currentJob || submitting || checkingJob) return;
  if (isJobAlreadyHandled()) return;

  const jobLink =
    currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  const description = currentJob.jobDescription?.trim() || '';
  const jobID = formatJobId(currentJob.linkedInJobId);

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
    postedAt: currentJob.postedAt || undefined,
    ...(jobID ? { jobID } : {}),
  };

  submitting = true;
  updateSendButton();

  try {
    const { ok, status, statusText, body } = await sendJobToScrapeApi(payload);

    if (ok && body?.success !== false) {
      if (currentJobKey) sentJobKeys.add(currentJobKey);
      jobExistsOnServer = true;
      if (jobID) {
        jobExistsCache.set(jobID, true);
      }
      if (body?.duplicate) {
        showToast('Already in catalog — duplicate detected.', 'success');
      } else if (body?.created) {
        showToast('Sent to server.', 'success');
      } else {
        showToast('Server accepted the request.', 'success');
      }
    } else {
      const message =
        body?.error || `Server responded with ${status} ${statusText}`;
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
