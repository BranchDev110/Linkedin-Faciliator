const AUTH_SYNC_EVENT = 'li-facilitator-auth-sync';
const AUTH_CLEAR_EVENT = 'li-facilitator-auth-clear';
const AUTH_FROM_EXTENSION_EVENT = 'li-facilitator-auth-from-extension';
const EXTENSION_SYNCED_EVENT = 'li-facilitator-extension-synced';
const BRIDGE_DEAD_KEY = 'li_facilitator_bridge_dead';
const TOKEN_KEY = 'li_facilitator_token';
const EMAIL_KEY = 'li_facilitator_email';
const SIGNED_OUT_KEY = 'li_facilitator_signed_out';

function isSignedOutOnWeb(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function clearBridgeDead() {
  try {
    sessionStorage.removeItem(BRIDGE_DEAD_KEY);
  } catch {
    // ignore
  }
}

function canUseExtensionRuntime(): boolean {
  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    return false;
  }
}

function safeSendMessage(
  message: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  if (!canUseExtensionRuntime()) {
    return Promise.resolve(undefined);
  }

  // Always retry messaging — service workers wake on demand and a transient
  // failure should not permanently disable the bridge for this tab.
  try {
    return chrome.runtime
      .sendMessage(message)
      .then((response) => {
        clearBridgeDead();
        return response as Record<string, unknown> | undefined;
      })
      .catch(() => undefined);
  } catch {
    return Promise.resolve(undefined);
  }
}

function dispatchExtensionSynced(success: boolean) {
  window.dispatchEvent(
    new CustomEvent(EXTENSION_SYNCED_EVENT, { detail: { success } }),
  );
}

function applyExtensionAuth(token: string, email: string) {
  const existingToken = localStorage.getItem(TOKEN_KEY);
  if (existingToken && existingToken !== token) {
    return;
  }

  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // ignore
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
  window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(AUTH_FROM_EXTENSION_EVENT));
}

async function validateTokenWithApi(token: string): Promise<boolean> {
  try {
    const response = await fetch('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401 || response.status === 403) {
      return false;
    }
    if (!response.ok) {
      return true;
    }

    const data = (await response.json()) as { user?: { uid?: string } | null };
    return Boolean(data.user?.uid);
  } catch {
    return true;
  }
}

async function notifyExtensionAfterSignIn(): Promise<boolean> {
  if (!canUseExtensionRuntime()) {
    dispatchExtensionSynced(false);
    return false;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY) || '';

  if (!token) {
    dispatchExtensionSynced(false);
    return false;
  }

  const response = await safeSendMessage({
    type: 'SYNC_AUTH_FROM_WEB',
    token,
    email,
  });

  const success = Boolean(response?.success);
  dispatchExtensionSynced(success);
  return success;
}

function syncExistingWebSessionToExtension() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !canUseExtensionRuntime()) return;
  void notifyExtensionAfterSignIn();
}

async function requestAuthFromExtension() {
  if (!canUseExtensionRuntime()) return;

  if (localStorage.getItem(TOKEN_KEY)) {
    syncExistingWebSessionToExtension();
    return;
  }

  const response = await safeSendMessage({ type: 'REQUEST_AUTH_FROM_EXTENSION' });
  const token = typeof response?.token === 'string' ? response.token : '';
  if (!token) return;

  const valid = await validateTokenWithApi(token);
  if (!valid) {
    await safeSendMessage({ type: 'CLEAR_STALE_EXTENSION_AUTH' });
    return;
  }

  applyExtensionAuth(token, typeof response?.email === 'string' ? response.email : '');
}

function notifySignOut() {
  safeSendMessage({ type: 'LI_FACILITATOR_SIGNOUT' });
}

function onAuthSync() {
  if (isSignedOutOnWeb()) return;
  void notifyExtensionAfterSignIn();
}

function onAuthClear() {
  try {
    sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    // ignore
  }
  notifySignOut();
}

function onWindowMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type !== 'LI_FACILITATOR_AUTH') return;

  // Explicit login postMessage always clears the signed-out guard and syncs.
  if (typeof event.data?.token === 'string' && event.data.token) {
    try {
      sessionStorage.removeItem(SIGNED_OUT_KEY);
    } catch {
      // ignore
    }
    localStorage.setItem(TOKEN_KEY, event.data.token);
    if (typeof event.data.email === 'string') {
      localStorage.setItem(EMAIL_KEY, event.data.email);
    }
  }

  void notifyExtensionAfterSignIn();
}

window.addEventListener('message', onWindowMessage);
window.addEventListener(AUTH_SYNC_EVENT, onAuthSync);
window.addEventListener(AUTH_CLEAR_EVENT, onAuthClear);

if (canUseExtensionRuntime()) {
  clearBridgeDead();

  if (isSignedOutOnWeb()) {
    // Do not pull stale extension sessions into a signed-out web tab.
  } else if (localStorage.getItem(TOKEN_KEY)) {
    syncExistingWebSessionToExtension();
  } else {
    void requestAuthFromExtension();
  }
}
