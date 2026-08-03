/**
 * Web persistence for tokens / device_id. SecureStore is native-only;
 * localStorage is the web fallback approved with option 1.
 */

import type { SecureStorage } from './secureStorageTypes';

function webStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    // Private mode / SSR.
  }
  return null;
}

export function createPlatformSecureStorage(): SecureStorage {
  return {
    async getItem(key) {
      return webStorage()?.getItem(key) ?? null;
    },
    async setItem(key, value) {
      webStorage()?.setItem(key, value);
    },
    async deleteItem(key) {
      webStorage()?.removeItem(key);
    },
  };
}
