/**
 * Token / device_id persistence (DESIGN §13 settled: expo-secure-store).
 *
 * Platform backends live in `createPlatformSecureStorage.{native,web}.ts`.
 * Do **not** name them `secureStorage.native.ts` — Metro would resolve
 * `import './secureStorage'` to that file and drop `getSecureStorage`.
 */

import { createPlatformSecureStorage } from './createPlatformSecureStorage';
import type { SecureStorage } from './secureStorageTypes';

export type { SecureStorage } from './secureStorageTypes';

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
