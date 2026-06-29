import { getStorage, setStorage, WEB_URL } from './shared';
import { storageGet } from './extension-storage';
import {
  clearAuthStorage,
  isAppWebUrl,
  persistAuthSession,
  SIGNED_OUT_KEY,
} from './auth-session';
import { extractApplyUrlFromVoyagerPayload } from './linkedin-voyager';

const VOYAGER_JOB_POSTINGS_ENDPOINT = (jobId: string) =>
  `https://www.linkedin.com/voyager/api/jobs/jobPostings/${jobId}`;

async function getLinkedInCsrfToken(): Promise<string> {
  const cookie = await chrome.cookies.get({
    url: 'https://www.linkedin.com/',
    name: 'JSESSIONID',
  });

  return cookie?.value?.replace(/^"|"$/g, '') || '';
}

async function buildLinkedInCookieHeader(): Promise<string> {
  const cookies = await chrome.cookies.getAll({ domain: '.linkedin.com' });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function fetchCompanyApplyUrlViaVoyagerBackground(jobId: string): Promise<string> {
  if (!jobId || !/^\d+$/.test(jobId)) return '';

  const csrf = await getLinkedInCsrfToken();
  const cookieHeader = await buildLinkedInCookieHeader();
  if (!csrf || !cookieHeader) return '';

  const headers = {
    'csrf-token': csrf,
    accept: 'application/vnd.linkedin.normalized+json+2.1',
    'x-li-lang': 'en_US',
    'x-restli-protocol-version': '2.0.0',
    cookie: cookieHeader,
  };

  for (const endpoint of [VOYAGER_JOB_POSTINGS_ENDPOINT(jobId)]) {
    try {
      const response = await fetch(endpoint, { headers });
      if (!response.ok) continue;

      const payload = await response.json();
      const url = extractApplyUrlFromVoyagerPayload(payload);
      if (url) return url;
    } catch {
      // try next endpoint
    }
  }

  return '';
}

const WEB_URL_PATTERNS = [
  `${WEB_URL.replace(/\/$/, '')}/*`,
  'http://localhost:5173/*',
  'http://localhost:3001/*',
  'http://localhost:3002/*',
];

async function readTokenFromTab(
  tabId: number,
): Promise<{ token: string; email: string } | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          if (sessionStorage.getItem('li_facilitator_signed_out') === '1') {
            return null;
          }
        } catch {
          // ignore
        }

        const token = localStorage.getItem('li_facilitator_token');
        if (!token) return null;

        return {
          token,
          email: localStorage.getItem('li_facilitator_email') || '',
        };
      },
    });

    const data = results?.[0]?.result as { token: string; email: string } | null;
    if (!data?.token) return null;

    return data;
  } catch {
    return null;
  }
}

async function syncAuthFromActiveWebTab(): Promise<{ token: string; email: string } | null> {
  let storage: Record<string, unknown>;
  try {
    storage = await storageGet<Record<string, unknown>>([SIGNED_OUT_KEY]);
  } catch {
    return null;
  }

  if (storage[SIGNED_OUT_KEY]) {
    return null;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || !isAppWebUrl(activeTab.url)) {
    return null;
  }

  const data = await readTokenFromTab(activeTab.id);
  if (!data?.token) {
    return null;
  }

  return persistAuthSession(data.token, data.email);
}

async function resolveAuthSession(): Promise<{ token: string; email: string } | null> {
  const storage = await getStorage();
  if (storage.signedOut) {
    return null;
  }

  if (storage.token) {
    const validated = await persistAuthSession(storage.token, storage.email || '');
    if (validated) return validated;
    await clearAuthStorage();
    return null;
  }

  return syncAuthFromActiveWebTab();
}

async function syncAuthToAllWebTabs(token: string, email: string): Promise<void> {
  for (const url of WEB_URL_PATTERNS) {
    const tabs = await chrome.tabs.query({ url });
    for (const tab of tabs) {
      if (!tab.id) continue;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: (nextToken: string, nextEmail: string) => {
            try {
              sessionStorage.removeItem('li_facilitator_signed_out');
            } catch {
              // ignore
            }
            localStorage.setItem('li_facilitator_token', nextToken);
            localStorage.setItem('li_facilitator_email', nextEmail);
            window.dispatchEvent(new CustomEvent('li-facilitator-auth-from-extension'));
          },
          args: [token, email],
        });
      } catch {
        // Tab may not allow scripting.
      }
    }
  }
}

async function clearWebAuthFromOpenTabs(): Promise<void> {
  for (const url of WEB_URL_PATTERNS) {
    const tabs = await chrome.tabs.query({ url });
    for (const tab of tabs) {
      if (!tab.id) continue;

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: () => {
            localStorage.removeItem('li_facilitator_token');
            localStorage.removeItem('li_facilitator_email');
            try {
              sessionStorage.setItem('li_facilitator_signed_out', '1');
            } catch {
              // ignore
            }
            window.dispatchEvent(new CustomEvent('li-facilitator-auth-clear'));
          },
        });
      } catch {
        // Tab may not allow scripting.
      }
    }
  }
}

async function pushAuthToTab(tabId: number): Promise<void> {
  const validated = await resolveAuthSession();
  if (!validated) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (token: string, email: string) => {
        try {
          sessionStorage.removeItem('li_facilitator_signed_out');
        } catch {
          // ignore
        }
        localStorage.setItem('li_facilitator_token', token);
        localStorage.setItem('li_facilitator_email', email);
        window.dispatchEvent(new CustomEvent('li-facilitator-auth-from-extension'));
      },
      args: [validated.token, validated.email],
    });
  } catch {
    // Tab may not allow scripting yet.
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LI_FACILITATOR_AUTH' || message.type === 'SYNC_AUTH_FROM_WEB') {
    (async () => {
      if (!message.token) {
        await clearAuthStorage();
        sendResponse({ success: true });
        return;
      }

      const validated = await persistAuthSession(
        message.token,
        message.email || '',
      );
      if (!validated) {
        await clearAuthStorage();
        sendResponse({ success: false });
        return;
      }

      await syncAuthToAllWebTabs(validated.token, validated.email);
      sendResponse({ success: true, ...validated });
    })();
    return true;
  }

  if (message.type === 'LI_FACILITATOR_SIGNOUT') {
    (async () => {
      await clearWebAuthFromOpenTabs();
      await clearAuthStorage();
      sendResponse({ success: true });
    })();
    return true;
  }

  if (
    message.type === 'REFRESH_AUTH_TOKEN' ||
    message.type === 'GET_AUTH_STATE' ||
    message.type === 'REQUEST_AUTH_FROM_EXTENSION'
  ) {
    (async () => {
      try {
        const storage = await getStorage();
        if (storage.signedOut) {
          sendResponse({});
          return;
        }

        if (message.type === 'REFRESH_AUTH_TOKEN' && message.forceRefresh) {
          const fromActiveTab = await syncAuthFromActiveWebTab();
          if (fromActiveTab) {
            sendResponse(fromActiveTab);
            return;
          }
        }

        const validated = await resolveAuthSession();
        sendResponse(validated || {});
      } catch {
        sendResponse({});
      }
    })();
    return true;
  }

  if (message.type === 'FETCH_VOYAGER_APPLY_URL') {
    (async () => {
      const jobId = typeof message.jobId === 'string' ? message.jobId : '';
      const url = await fetchCompanyApplyUrlViaVoyagerBackground(jobId);
      sendResponse({ url });
    })();
    return true;
  }

  if (message.type === 'OPEN_WEB_APP') {
    (async () => {
      const validated = await resolveAuthSession();
      if (!validated?.token) {
        sendResponse({ success: false, reason: 'not_authenticated' });
        return;
      }

      const rawPath = typeof message.path === 'string' ? message.path : '/dashboard';
      const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
      const url = new URL(`${WEB_URL.replace(/\/$/, '')}${path}`);
      url.searchParams.set('source', 'extension');

      const tab = await chrome.tabs.create({ url: url.toString() });
      if (!tab.id) {
        sendResponse({ success: false });
        return;
      }

      const tabId = tab.id;
      const onUpdated = async (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        await pushAuthToTab(tabId);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
      sendResponse({ success: true });
    })();
    return true;
  }
});

chrome.alarms.create('checkAuth', { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'checkAuth') return;

  const storage = await getStorage();
  if (storage.signedOut) return;

  await resolveAuthSession();
});

chrome.runtime.onInstalled.addListener(async () => {
  try {
    await resolveAuthSession();
  } catch {
    // Extension context not ready yet.
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!isAppWebUrl(tab.url)) return;

    const validated = await syncAuthFromActiveWebTab();
    if (validated) {
      await syncAuthToAllWebTabs(validated.token, validated.email);
    }
  } catch {
    // Tab may not be accessible.
  }
});

async function toggleSidebarOnTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR' });
    return;
  } catch {
    // Content script may not be ready yet on this tab.
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['sidebar-host.js'],
    });
    await chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_SIDEBAR' });
  } catch {
    // Restricted pages like chrome:// cannot host the sidebar.
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await toggleSidebarOnTab(tab.id);
});
