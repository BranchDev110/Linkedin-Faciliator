import { getStorage, setStorage, WEB_URL } from './shared';
import { validateAuthToken } from './auth-validation';

const WEB_URL_PATTERNS = [
  `${WEB_URL.replace(/\/$/, '')}/*`,
  'http://localhost:5173/*',
];

async function persistValidatedSession(
  token: string,
  email: string,
): Promise<{ token: string; email: string } | null> {
  const validated = await validateAuthToken(token);
  if (!validated) return null;

  await setStorage({
    token: validated.token,
    email: validated.email || email,
  });

  return {
    token: validated.token,
    email: validated.email || email,
  };
}

async function readTokenFromTab(
  tabId: number,
): Promise<{ token: string; email: string } | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
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

async function syncAuthFromOpenWebTabs(): Promise<{ token: string; email: string } | null> {
  for (const url of WEB_URL_PATTERNS) {
    const tabs = await chrome.tabs.query({ url });
    for (const tab of tabs) {
      if (!tab.id) continue;

      const data = await readTokenFromTab(tab.id);
      if (!data?.token) continue;

      const validated = await persistValidatedSession(data.token, data.email);
      if (validated) return validated;
    }
  }

  return null;
}

async function resolveAuthSession(options?: {
  preferWebTabs?: boolean;
}): Promise<{ token: string; email: string } | null> {
  if (!options?.preferWebTabs) {
    const fromExtension = await getValidatedStorage();
    if (fromExtension) return fromExtension;
  }

  const fromWebTabs = await syncAuthFromOpenWebTabs();
  if (fromWebTabs) return fromWebTabs;

  if (options?.preferWebTabs) {
    return getValidatedStorage();
  }

  return null;
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
            window.dispatchEvent(new CustomEvent('li-facilitator-auth-sync'));
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
        localStorage.setItem('li_facilitator_token', token);
        localStorage.setItem('li_facilitator_email', email);
        window.dispatchEvent(new CustomEvent('li-facilitator-auth-sync'));
        window.dispatchEvent(new CustomEvent('li-facilitator-auth-from-extension'));
      },
      args: [validated.token, validated.email],
    });
  } catch {
    // Tab may not allow scripting yet.
  }
}

async function getValidatedStorage(): Promise<{ token: string; email: string } | null> {
  const storage = await getStorage();
  if (!storage.token) return null;

  const validated = await persistValidatedSession(
    storage.token,
    storage.email || '',
  );
  if (!validated) {
    await chrome.storage.local.remove(['token', 'email']);
  }
  return validated;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'LI_FACILITATOR_AUTH' || message.type === 'SYNC_AUTH_FROM_WEB') {
    (async () => {
      if (!message.token) {
        await chrome.storage.local.remove(['token', 'email']);
        sendResponse({ success: true });
        return;
      }

      const validated = await persistValidatedSession(
        message.token,
        message.email || '',
      );
      if (!validated) {
        await chrome.storage.local.remove(['token', 'email']);
        sendResponse({ success: false });
        return;
      }

      sendResponse({ success: true, ...validated });
    })();
    return true;
  }

  if (message.type === 'LI_FACILITATOR_SIGNOUT') {
    (async () => {
      await clearWebAuthFromOpenTabs();
      await chrome.storage.local.remove(['token', 'email', 'lastApplicationId']);
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
      const validated = await resolveAuthSession({
        preferWebTabs:
          message.type === 'REFRESH_AUTH_TOKEN' && Boolean(message.forceRefresh),
      });
      sendResponse(validated || {});
    })();
    return true;
  }

  if (message.type === 'OPEN_WEB_APP') {
    (async () => {
      const validated = await resolveAuthSession({ preferWebTabs: true });
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
  await resolveAuthSession({ preferWebTabs: true });
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
