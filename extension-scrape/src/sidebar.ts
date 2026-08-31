import { SENDER } from './config';
import { sendJobToScrapeApi } from './api';
// Disabled together with the /api/jobs/check "already recorded" engine below.
// import { checkJobExists, formatJobId } from './api';
import type { IngestPayload } from './api';
import type { ExtractedJob } from './extract-job';

const emptyState = document.getElementById('empty-state') as HTMLDivElement;
const jobPanel = document.getElementById('job-panel') as HTMLDivElement;
const jobTitleEl = document.getElementById('job-title') as HTMLHeadingElement;
const jobCompanyEl = document.getElementById('job-company') as HTMLParagraphElement;
const jobPostedAtEl = document.getElementById('job-posted-at') as HTMLSpanElement;
const jobRecordedNotice = document.getElementById('job-recorded-notice') as HTMLDivElement;
const companyAvatarEl = document.getElementById('company-avatar') as HTMLDivElement;
const jobTagsEl = document.getElementById('job-tags') as HTMLDivElement;
const jobApplicantsEl = document.getElementById('job-applicants') as HTMLSpanElement;
const jobSignalsEl = document.getElementById('job-signals') as HTMLDivElement;
const jobLinkEl = document.getElementById('job-link') as HTMLAnchorElement;
const jdTextEl = document.getElementById('jd-text') as HTMLTextAreaElement;
const btnSend = document.getElementById('btn-send') as HTMLButtonElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const emptyStateTextEl = document.getElementById('empty-state-text') as HTMLParagraphElement;
const toastEl = document.getElementById('toast') as HTMLDivElement;

const LINKEDIN_URL_PATTERN = /^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\//i;
const EMPTY_MESSAGE_DEFAULT = 'Open a LinkedIn job posting to extract its description.';
const EMPTY_MESSAGE_NO_JOB =
  'No job posting detected on this page yet. Open a LinkedIn job to continue.';
const EMPTY_MESSAGE_STALE = 'Refresh this LinkedIn page to reconnect the scraper.';

let currentJob: ExtractedJob | null = null;
let emptyMessage = EMPTY_MESSAGE_DEFAULT;
// The panel outlives any single tab, so track which tab it is mirroring.
let activeTabId: number | null = null;
let panelWindowId: number | null = null;
let syncToken = 0;
let submitting = false;
// Check engine disabled — /api/jobs/check is not working.
// let checkingJob = false;
// let jobExistsOnServer = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let currentJobKey = '';
// Scrape always sends: no session-level dedupe either.
// const sentJobKeys = new Set<string>();
// const jobExistsCache = new Map<string, boolean>();
// const checkInFlight = new Map<string, Promise<boolean>>();

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

function setJobTags(tags: string[] | undefined): void {
  jobTagsEl.textContent = '';

  const list = (tags || []).filter((tag) => tag.trim().length > 0);
  if (!list.length) {
    jobTagsEl.classList.add('hidden');
    return;
  }

  for (const tag of list) {
    const chip = document.createElement('span');
    chip.className = 'job-tag';
    chip.textContent = tag;
    jobTagsEl.appendChild(chip);
  }
  jobTagsEl.classList.remove('hidden');
}

function setJobApplicants(text: string | undefined): void {
  const value = text?.trim() || '';
  if (!value) {
    jobApplicantsEl.textContent = '';
    jobApplicantsEl.classList.add('hidden');
    return;
  }

  jobApplicantsEl.textContent = value;
  jobApplicantsEl.classList.remove('hidden');
}

function showToast(message: string, kind: 'success' | 'warning' | 'error'): void {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden', 'success', 'warning', 'error');
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

function showWarning(message: string): void {
  showToast(message, 'warning');
}

// function isJobAlreadyHandled(): boolean {
//   return jobExistsOnServer || (currentJobKey !== '' && sentJobKeys.has(currentJobKey));
// }

function canSend(): boolean {
  if (!currentJob) return false;
  // if (submitting || checkingJob) return false;
  if (submitting) return false;
  // if (isJobAlreadyHandled()) return false;

  const description = currentJob.jobDescription?.trim() || '';
  if (description.length === 0) return false;

  const jobLink = currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  if (!/^https?:\/\//.test(jobLink)) return false;

  return true;
}

function updateRecordedNotice(): void {
  // if (checkingJob) {
  //   jobRecordedNotice.textContent = 'Checking if this job is already recorded…';
  //   jobRecordedNotice.className = 'job-recorded-notice is-checking';
  //   jobRecordedNotice.classList.remove('hidden');
  //   return;
  // }

  // if (jobExistsOnServer || (currentJobKey && sentJobKeys.has(currentJobKey))) {
  //   jobRecordedNotice.textContent = 'This job is already recorded on the server.';
  //   jobRecordedNotice.className = 'job-recorded-notice is-recorded';
  //   jobRecordedNotice.classList.remove('hidden');
  //   return;
  // }

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

  // if (checkingJob) {
  //   btnSend.disabled = true;
  //   btnSend.textContent = 'Checking…';
  //   return;
  // }

  // if (isJobAlreadyHandled()) {
  //   btnSend.disabled = true;
  //   btnSend.textContent = 'Already recorded';
  //   return;
  // }

  btnSend.disabled = !canSend();
  btnSend.textContent = 'Scrape';
}

function render(): void {
  if (!currentJob) {
    emptyStateTextEl.textContent = emptyMessage;
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
  setJobTags(currentJob.tags);
  setJobApplicants(currentJob.applicants?.text);
  jobSignalsEl.classList.toggle(
    'hidden',
    jobTagsEl.classList.contains('hidden') && jobApplicantsEl.classList.contains('hidden'),
  );
  setJobLink(currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim());

  jdTextEl.value = currentJob.jobDescription || '';

  updateSendButton();
}

// Check engine disabled — /api/jobs/check is not working. Restore this
// function (and the call site in setJob) to re-enable the lookup.
// async function refreshJobRecordedStatus(job: ExtractedJob): Promise<void> {
//   const jobID = formatJobId(job.linkedInJobId);
//   if (!jobID) {
//     jobExistsOnServer = false;
//     checkingJob = false;
//     updateSendButton();
//     return;
//   }
//
//   if (jobExistsCache.has(jobID)) {
//     jobExistsOnServer = jobExistsCache.get(jobID)!;
//     if (jobExistsOnServer && currentJobKey) {
//       sentJobKeys.add(currentJobKey);
//     }
//     checkingJob = false;
//     updateSendButton();
//     return;
//   }
//
//   const inFlight = checkInFlight.get(jobID);
//   if (inFlight) {
//     checkingJob = true;
//     updateSendButton();
//     try {
//       const exists = await inFlight;
//       if (formatJobId(currentJob?.linkedInJobId) !== jobID) {
//         return;
//       }
//       jobExistsOnServer = exists;
//       if (exists && currentJobKey) {
//         sentJobKeys.add(currentJobKey);
//       }
//     } finally {
//       if (formatJobId(currentJob?.linkedInJobId) === jobID) {
//         checkingJob = false;
//         updateSendButton();
//       }
//     }
//     return;
//   }
//
//   checkingJob = true;
//   updateSendButton();
//
//   const request = checkJobExists(jobID)
//     .then((result) => {
//       const exists = result?.success === true && result.exists === true;
//       jobExistsCache.set(jobID, exists);
//       return exists;
//     })
//     .catch(() => {
//       jobExistsCache.set(jobID, false);
//       return false;
//     });
//
//   checkInFlight.set(jobID, request);
//
//   try {
//     const exists = await request;
//     if (formatJobId(currentJob?.linkedInJobId) !== jobID) {
//       return;
//     }
//     jobExistsOnServer = exists;
//     if (exists && currentJobKey) {
//       sentJobKeys.add(currentJobKey);
//     }
//   } finally {
//     checkInFlight.delete(jobID);
//     if (formatJobId(currentJob?.linkedInJobId) === jobID) {
//       checkingJob = false;
//       updateSendButton();
//     }
//   }
// }

function setJob(job: ExtractedJob): void {
  const nextKey = jobKey(job);
  const sameJob = nextKey === currentJobKey;

  if (!sameJob) {
    currentJobKey = nextKey;
    // jobExistsOnServer = false;
  }

  currentJob = job;
  render();

  // Check engine disabled — nothing to look up on the server anymore.
  // if (!sameJob) {
  //   void refreshJobRecordedStatus(job);
  // } else {
  //   const jobID = formatJobId(job.linkedInJobId);
  //   if (jobID && jobExistsCache.has(jobID)) {
  //     jobExistsOnServer = jobExistsCache.get(jobID)!;
  //     updateSendButton();
  //   }
  // }
}

function clearJob(message: string): void {
  currentJob = null;
  currentJobKey = '';
  // jobExistsOnServer = false;
  // checkingJob = false;
  emptyMessage = message;
  render();
}

function setRefreshBusy(busy: boolean): void {
  btnRefresh.disabled = busy;
  btnRefresh.classList.toggle('is-busy', busy);
}

async function resolveActiveTab(): Promise<chrome.tabs.Tab | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  } catch {
    return null;
  }
}

// Pulls the current job straight from the tab's content script. The panel can
// be opened long after the content script last emitted JOB_DETECTED, so it
// always asks rather than waiting for the next DOM mutation.
async function syncWithActiveTab(): Promise<void> {
  if (!isExtensionContextValid()) return;

  const token = ++syncToken;
  const tab = await resolveActiveTab();
  if (token !== syncToken) return;

  if (!tab || typeof tab.id !== 'number' || !LINKEDIN_URL_PATTERN.test(tab.url || '')) {
    activeTabId = null;
    clearJob(EMPTY_MESSAGE_DEFAULT);
    return;
  }

  activeTabId = tab.id;
  setRefreshBusy(true);

  try {
    const response = (await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' })) as
      | { job?: ExtractedJob }
      | undefined;
    if (token !== syncToken) return;

    if (response?.job) {
      setJob(response.job);
    } else {
      clearJob(EMPTY_MESSAGE_NO_JOB);
    }
  } catch {
    // No content script on the page — usually the extension was reloaded.
    if (token === syncToken) clearJob(EMPTY_MESSAGE_STALE);
  } finally {
    if (token === syncToken) setRefreshBusy(false);
  }
}

function isPanelWindow(windowId: number | undefined): boolean {
  if (panelWindowId === null || windowId === undefined) return true;
  return windowId === panelWindowId;
}

function setupTabSync(): void {
  if (!isExtensionContextValid()) return;

  try {
    void chrome.windows
      .getCurrent()
      .then((win) => {
        panelWindowId = typeof win?.id === 'number' ? win.id : null;
      })
      .catch(() => {});

    chrome.tabs.onActivated.addListener((info) => {
      if (!isPanelWindow(info.windowId)) return;
      void syncWithActiveTab();
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (!tab.active || !isPanelWindow(tab.windowId)) return;
      // LinkedIn navigates via pushState, which surfaces here as a url change.
      if (!changeInfo.url && changeInfo.status !== 'complete') return;
      void syncWithActiveTab();
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId !== activeTabId) return;
      activeTabId = null;
      clearJob(EMPTY_MESSAGE_DEFAULT);
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;
      if (!isPanelWindow(windowId)) return;
      void syncWithActiveTab();
    });
  } catch {
    // Extension context may have become invalid; ignore.
  }
}

interface IncomingJobMessage {
  type?: string;
  job?: ExtractedJob;
}

function setupJobListener(): void {
  if (!isExtensionContextValid()) return;

  try {
    chrome.runtime.onMessage.addListener((rawMessage: unknown, sender) => {
      const message = rawMessage as IncomingJobMessage;
      if (message?.type !== 'JOB_DETECTED' && message?.type !== 'EXTRACT_JOB') return;
      if (!message.job) return;
      // Every LinkedIn tab broadcasts; only mirror the one the panel is on.
      if (activeTabId !== null && sender?.tab?.id !== activeTabId) return;

      setJob(message.job);
    });
  } catch {
    // Extension context may have become invalid; ignore.
  }
}

async function sendToApi(): Promise<void> {
  // if (!currentJob || submitting || checkingJob) return;
  if (!currentJob || submitting) return;
  // if (isJobAlreadyHandled()) return;

  const jobLink =
    currentJob.realJobUrl?.trim() || currentJob.linkedInJobUrl?.trim() || '';
  const description = currentJob.jobDescription?.trim() || '';
  // const jobID = formatJobId(currentJob.linkedInJobId);

  if (!description) {
    showError('No job description to send yet.');
    return;
  }
  if (!/^https?:\/\//.test(jobLink)) {
    showError('Job link is missing — cannot send.');
    return;
  }

  const linkedInJobId = currentJob.linkedInJobId?.trim() || '';

  const payload: IngestPayload = {
    createdBy: SENDER,
    jobs: [
      {
        title: currentJob.jobTitle || '',
        company: {
          name: currentJob.companyName || '',
          logo: currentJob.companyLogoUrl || '',
          tags: [],
        },
        description,
        applyLink: jobLink,
        companyLink: currentJob.companyLink || '',
        postedAgo: currentJob.postedAt || '',
        tags: currentJob.tags || [],
        skills: [],
        details: {
          location: currentJob.primaryLocation || currentJob.location || '',
        },
        ...(currentJob.applicants ? { applicants: currentJob.applicants } : {}),
        ...(linkedInJobId ? { id: linkedInJobId } : {}),
        scrapeFrom: 'LinkedIn',
      },
    ],
  };

  submitting = true;
  updateSendButton();

  try {
    const { ok, status, statusText, body } = await sendJobToScrapeApi(payload);

    if (ok && body?.success !== false) {
      // if (currentJobKey) sentJobKeys.add(currentJobKey);
      // jobExistsOnServer = true;
      // if (jobID) {
      //   jobExistsCache.set(jobID, true);
      // }
      // A single job is sent per request, so the first entry is the one to report.
      const result = body?.results?.[0];

      if (result) {
        if (result.success === false) {
          showError(result.error || 'Server rejected the job.');
        } else if (result.created === false && result.duplicate === true) {
          showWarning(result.reason || 'Duplicate job — already in catalog.');
        } else if (result.created === true) {
          showToast('Successfully created.', 'success');
        } else {
          showToast('Server accepted the request.', 'success');
        }
      } else {
        const duplicates = body?.duplicate === true ? 1 : body?.duplicates || 0;
        const createdCount =
          body?.created === true ? 1 : Number(body?.created ?? body?.inserted ?? 0);

        if (duplicates > 0 && createdCount === 0) {
          showWarning('Already in catalog — duplicate detected.');
        } else if (createdCount > 0) {
          showToast('Successfully created.', 'success');
        } else {
          showToast('Server accepted the request.', 'success');
        }
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

function setupRefreshButton(): void {
  btnRefresh.addEventListener('click', () => {
    void syncWithActiveTab();
  });
}

setupSendButton();
setupRefreshButton();
setupJobListener();
setupTabSync();
render();
void syncWithActiveTab();
