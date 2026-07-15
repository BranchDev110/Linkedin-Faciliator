import { extractJob } from './extract-job';
import { bindVoyagerJobPostingListener } from './linkedin-voyager-cache';

const CONTENT_SCRIPT_FLAG = '__liJobScraperContentLoaded';
const LAST_URL_KEY = '__liJobScraperLastUrl';

function isExtensionRuntimeValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

function shouldInitialize(): boolean {
  const flag = (window as Window & { [CONTENT_SCRIPT_FLAG]?: boolean })[CONTENT_SCRIPT_FLAG];
  if (!flag) return true;
  return !isExtensionRuntimeValid();
}

if (!shouldInitialize()) {
  // Already initialized with a live extension context.
} else {
  (window as Window & { [CONTENT_SCRIPT_FLAG]?: boolean })[CONTENT_SCRIPT_FLAG] = true;

  bindVoyagerJobPostingListener();

  let notifyTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPublishedKey = '';
  let lastPublishedDescriptionLength = 0;
  let lastPublishedTitle = '';
  let lastPublishedCompany = '';

  function jobPublishKey(job: NonNullable<Awaited<ReturnType<typeof extractJob>>>): string {
    return (
      job.linkedInJobId?.trim() ||
      job.linkedInJobUrl?.trim() ||
      job.jobUrl?.trim() ||
      `${job.jobTitle}|${job.companyName}`
    );
  }

  function normalizeTitle(title: string | undefined): string {
    const value = title?.trim() || '';
    if (!value || value.toLowerCase() === 'unknown position') return '';
    return value;
  }

  function normalizeCompany(company: string | undefined): string {
    const value = company?.trim() || '';
    if (!value || value.toLowerCase() === 'unknown company') return '';
    return value;
  }

  function recordPublishedState(
    job: NonNullable<Awaited<ReturnType<typeof extractJob>>>,
    descriptionLength: number,
  ): void {
    lastPublishedKey = jobPublishKey(job);
    lastPublishedDescriptionLength = descriptionLength;
    lastPublishedTitle = normalizeTitle(job.jobTitle);
    lastPublishedCompany = normalizeCompany(job.companyName);
  }

  function shouldPublishJob(job: NonNullable<Awaited<ReturnType<typeof extractJob>>>): boolean {
    const key = jobPublishKey(job);
    const descriptionLength = job.jobDescription?.trim().length || 0;
    const title = normalizeTitle(job.jobTitle);
    const company = normalizeCompany(job.companyName);

    if (!key) {
      return descriptionLength > 0 || Boolean(title) || Boolean(company);
    }

    if (key !== lastPublishedKey) {
      recordPublishedState(job, descriptionLength);
      return true;
    }

    if (descriptionLength > lastPublishedDescriptionLength + 30) {
      recordPublishedState(job, descriptionLength);
      return true;
    }

    // Title and company often render after the job id/description on SPA navigation.
    if (title && title !== lastPublishedTitle) {
      recordPublishedState(job, descriptionLength);
      return true;
    }

    if (company && company !== lastPublishedCompany) {
      recordPublishedState(job, descriptionLength);
      return true;
    }

    return false;
  }

  function notifyJobUpdate() {
    if (!isExtensionRuntimeValid()) {
      observer.disconnect();
      return;
    }

    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      if (!isExtensionRuntimeValid()) return;

      void extractJob({ allowVoyagerFetch: true }).then((job) => {
        if (!job || !shouldPublishJob(job)) return;
        chrome.runtime.sendMessage({ type: 'JOB_DETECTED', job }).catch(() => {});
      });
    }, 500);
  }

  function getCurrentUrl(): string {
    return window.location.href;
  }

  function handleUrlChange() {
    const w = window as Window & { [LAST_URL_KEY]?: string };
    const currentUrl = getCurrentUrl();
    if (w[LAST_URL_KEY] === currentUrl) return;
    w[LAST_URL_KEY] = currentUrl;
    lastPublishedKey = '';
    lastPublishedDescriptionLength = 0;
    lastPublishedTitle = '';
    lastPublishedCompany = '';
    notifyJobUpdate();
  }

  function setupUrlChangeListener() {
    const w = window as Window & { [LAST_URL_KEY]?: string };
    w[LAST_URL_KEY] = getCurrentUrl();

    // Back/forward navigation.
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    // LinkedIn uses history.pushState for SPA job navigation; wrap it so we
    // get notified on the same tick instead of waiting for the MutationObserver.
    const originalPushState = history.pushState.bind(history);
    history.pushState = function pushState(...args) {
      const result = originalPushState.apply(history, args);
      handleUrlChange();
      return result;
    };

    const originalReplaceState = history.replaceState.bind(history);
    history.replaceState = function replaceState(...args) {
      const result = originalReplaceState.apply(history, args);
      handleUrlChange();
      return result;
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'EXTRACT_JOB') {
      void extractJob({ allowVoyagerFetch: true }).then((job) => sendResponse({ job }));
      return true;
    }
  });

  const observer = new MutationObserver(notifyJobUpdate);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    setupUrlChangeListener();
    notifyJobUpdate();
  }
}
