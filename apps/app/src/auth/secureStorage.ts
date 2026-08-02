/**
 * Token / device_id persistence (DESIGN §13 settled: expo-secure-store).
 * Metro resolves `secureStorage.native.ts` / `secureStorage.web.ts`;
 * this file is the Vitest / tsc fallback (web + injectable memory).
 */

import { createPlatformSecureStorage } from './secureStorage.web.js';
import type { SecureStorage } from './secureStorageTypes.js';

export type { SecureStorage } from './secureStorageTypes.js';

let override: SecureStorage | null = null;
let platformStorage: SecureStorage | null = null;

export function setSecureStorageForTests(storage: SecureStorage | null): void {
  override = storage;
}

export function getSecureStorage(): SecureStorage {
  if (override) return override;
  if (platformStorage === null) {
    platformStorage = createPlatformSecureStorage();
  }
  return platformStorage;
}

/** In-memory backend for unit tests (no native / DOM dependency). */
export function createMemorySecureStorage(): SecureStorage {
  const map = new Map<string, string>();
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async deleteItem(key) {
      map.delete(key);
    },
  };
}
