import {
  EMAIL_KEY,
  EXTENSION_SYNCED_EVENT,
  TOKEN_KEY,
} from './auth-session';

export function waitForExtensionSync(timeoutMs = 2500): Promise<boolean> {
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

    window.postMessage(
      {
        type: 'LI_FACILITATOR_AUTH',
        token: localStorage.getItem(TOKEN_KEY) || '',
        email: localStorage.getItem(EMAIL_KEY) || '',
      },
      window.location.origin,
    );
  });
}
