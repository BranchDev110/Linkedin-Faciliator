import { extractJob } from './extract-job';

const CONTENT_SCRIPT_FLAG = '__liFacilitatorContentLoaded';

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

  let notifyTimer: ReturnType<typeof setTimeout> | null = null;

  function notifyJobUpdate() {
    if (!isExtensionRuntimeValid()) {
      observer.disconnect();
      return;
    }

    if (notifyTimer) clearTimeout(notifyTimer);
    notifyTimer = setTimeout(() => {
      if (!isExtensionRuntimeValid()) return;

      const job = extractJob();
      if (job) {
        chrome.runtime.sendMessage({ type: 'JOB_DETECTED', job }).catch(() => {});
      }
    }, 500);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === 'EXTRACT_JOB') {
      sendResponse({ job: extractJob() });
      return true;
    }
  });

  const observer = new MutationObserver(notifyJobUpdate);
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    notifyJobUpdate();
  }
}
