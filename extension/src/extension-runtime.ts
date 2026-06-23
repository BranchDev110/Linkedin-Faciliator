export class ExtensionContextError extends Error {
  constructor(message = 'Extension context invalidated') {
    super(message);
    this.name = 'ExtensionContextError';
  }
}

export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function assertExtensionContext(): void {
  if (!isExtensionContextValid()) {
    throw new ExtensionContextError();
  }
}

export function isExtensionContextError(error: unknown): boolean {
  if (error instanceof ExtensionContextError) {
    return true;
  }

  if (error instanceof Error) {
    return error.message.includes('Extension context invalidated');
  }

  return false;
}

export function requestSidebarReload(): void {
  try {
    window.parent.postMessage({ type: 'LI_FACILITATOR_RELOAD_SIDEBAR' }, '*');
  } catch {
    // ignore
  }
}

export function installExtensionErrorHandlers(onStale?: () => void): void {
  const handleStale = (error: unknown) => {
    if (!isExtensionContextError(error)) {
      return false;
    }

    onStale?.();
    return true;
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (handleStale(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    if (handleStale(event.error ?? event.message)) {
      event.preventDefault();
    }
  });
}
