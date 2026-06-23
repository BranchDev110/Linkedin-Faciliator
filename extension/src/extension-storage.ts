import {
  ExtensionContextError,
  isExtensionContextError,
  isExtensionContextValid,
} from './extension-runtime';

function readRuntimeLastError(): string | null {
  try {
    const lastError = chrome.runtime.lastError;
    return lastError?.message ?? null;
  } catch {
    return 'Extension context invalidated';
  }
}

function rejectStorageError(
  reject: (reason: ExtensionContextError) => void,
  error: unknown,
): void {
  reject(isExtensionContextError(error) ? error : new ExtensionContextError());
}

export function storageGet<T extends Record<string, unknown>>(
  keys: string[] | Record<string, unknown>,
): Promise<T> {
  if (!isExtensionContextValid()) {
    return Promise.reject(new ExtensionContextError());
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        try {
          const message = readRuntimeLastError();
          if (message) {
            reject(new ExtensionContextError(message));
            return;
          }
          resolve(result as T);
        } catch (error) {
          rejectStorageError(reject, error);
        }
      });
    } catch (error) {
      rejectStorageError(reject, error);
    }
  });
}

export function storageSet(data: Record<string, unknown>): Promise<void> {
  if (!isExtensionContextValid()) {
    return Promise.reject(new ExtensionContextError());
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set(data, () => {
        try {
          const message = readRuntimeLastError();
          if (message) {
            reject(new ExtensionContextError(message));
            return;
          }
          resolve();
        } catch (error) {
          rejectStorageError(reject, error);
        }
      });
    } catch (error) {
      rejectStorageError(reject, error);
    }
  });
}

export function storageRemove(keys: string | string[]): Promise<void> {
  if (!isExtensionContextValid()) {
    return Promise.reject(new ExtensionContextError());
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.remove(keys, () => {
        try {
          const message = readRuntimeLastError();
          if (message) {
            reject(new ExtensionContextError(message));
            return;
          }
          resolve();
        } catch (error) {
          rejectStorageError(reject, error);
        }
      });
    } catch (error) {
      rejectStorageError(reject, error);
    }
  });
}
