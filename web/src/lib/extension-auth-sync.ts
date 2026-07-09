import {
  EMAIL_KEY,
  EXTENSION_SYNCED_EVENT,
  TOKEN_KEY,
} from './auth-session';

/**
 * Best-effort sync of the web session into the Chrome extension.
 * Always resolves quickly — never blocks navigation on extension availability.
 */
export function waitForExtensionSync(timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (success: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener(EXTENSION_SYNCED_EVENT, onSynced);
      resolve(success);
    };

    const onSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ success?: boolean }>).detail;
      finish(Boolean(detail?.success));
    };

    const timer = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener(EXTENSION_SYNCED_EVENT, onSynced);

    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      finish(false);
      return;
    }

    window.postMessage(
      {
        type: 'LI_FACILITATOR_AUTH',
        token,
        email: localStorage.getItem(EMAIL_KEY) || '',
      },
      window.location.origin,
    );
  });
}
