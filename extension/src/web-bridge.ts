const AUTH_SYNC_EVENT = 'li-facilitator-auth-sync';
const AUTH_CLEAR_EVENT = 'li-facilitator-auth-clear';
const AUTH_FROM_EXTENSION_EVENT = 'li-facilitator-auth-from-extension';
const BRIDGE_DEAD_KEY = 'li_facilitator_bridge_dead';
const TOKEN_KEY = 'li_facilitator_token';
const EMAIL_KEY = 'li_facilitator_email';

let tornDown = false;

function markBridgeDead() {
  tornDown = true;
  try {
    sessionStorage.setItem(BRIDGE_DEAD_KEY, '1');
  } catch {
    // ignore
  }
}

function isBridgeActive(): boolean {
  if (tornDown) return false;
  try {
    if (sessionStorage.getItem(BRIDGE_DEAD_KEY) === '1') {
      tornDown = true;
      return false;
    }
  } catch {
    // ignore
  }
  return true;
}

function canUseExtensionRuntime(): boolean {
  if (!isBridgeActive()) return false;

  try {
    return Boolean(chrome.runtime && chrome.runtime.id);
  } catch {
    markBridgeDead();
    return false;
  }
}

function safeSendMessage(message: Record<string, unknown>) {
  if (!canUseExtensionRuntime()) return;

  try {
    chrome.runtime
      .sendMessage(message)
      .then(() => {
        tornDown = false;
        try {
          sessionStorage.removeItem(BRIDGE_DEAD_KEY);
        } catch {
          // ignore
        }
      })
      .catch(() => {
        markBridgeDead();
      });
  } catch {
    markBridgeDead();
  }
}

function applyExtensionAuth(token: string, email: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
  window.dispatchEvent(new CustomEvent(AUTH_SYNC_EVENT));
  window.dispatchEvent(new CustomEvent(AUTH_FROM_EXTENSION_EVENT));
}

function notifyExtensionAfterSignIn() {
  if (!canUseExtensionRuntime()) return;

  const token = localStorage.getItem(TOKEN_KEY);
  const email = localStorage.getItem(EMAIL_KEY);

  if (!token) {
    safeSendMessage({ type: 'LI_FACILITATOR_SIGNOUT' });
    return;
  }

  safeSendMessage({
    type: 'SYNC_AUTH_FROM_WEB',
    token,
    email,
  });
}

function syncExistingWebSessionToExtension() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !canUseExtensionRuntime()) return;
  notifyExtensionAfterSignIn();
}

function requestAuthFromExtension() {
  if (!canUseExtensionRuntime()) return;

  try {
    chrome.runtime
      .sendMessage({ type: 'REQUEST_AUTH_FROM_EXTENSION' })
      .then((response: { token?: string; email?: string } | undefined) => {
        if (!response?.token) return;
        applyExtensionAuth(response.token, response.email || '');
      })
      .catch(() => {
        markBridgeDead();
      });
  } catch {
    markBridgeDead();
  }
}

function notifySignOut() {
  safeSendMessage({ type: 'LI_FACILITATOR_SIGNOUT' });
}

function onAuthSync() {
  notifyExtensionAfterSignIn();
}

function onAuthClear() {
  notifySignOut();
}

function onWindowMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === 'LI_FACILITATOR_AUTH') {
    onAuthSync();
  }
}

window.addEventListener('message', onWindowMessage);
window.addEventListener(AUTH_SYNC_EVENT, onAuthSync);
window.addEventListener(AUTH_CLEAR_EVENT, onAuthClear);

if (canUseExtensionRuntime()) {
  const fromExtension =
    new URLSearchParams(window.location.search).get('source') === 'extension';

  if (fromExtension) {
    requestAuthFromExtension();
  } else if (!localStorage.getItem(TOKEN_KEY)) {
    requestAuthFromExtension();
  } else {
    syncExistingWebSessionToExtension();
  }
}
