/**
 * Per-install `device_id` (DESIGN §5). Generated once and stored beside the
 * local database — a reinstall wipes local data and gets a new id.
 *
 * Persistence mirrors `config/server-url`: localStorage on web when available;
 * in-memory otherwise until a native store lands with the Android toolchain.
 */

const STORAGE_KEY = 'locus.deviceId';

let memoryDeviceId: string | null = null;

function webStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    // Private mode / SSR — fall through to memory.
  }
  return null;
}

function createDeviceId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  // Extremely narrow fallback for test hosts without Web Crypto.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable UUID for this install; creates and persists on first call. */
export function getDeviceId(): string {
  const storage = webStorage();
  if (storage) {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored !== null && stored.length > 0) return stored;
  }
  if (memoryDeviceId !== null) return memoryDeviceId;

  const id = createDeviceId();
  memoryDeviceId = id;
  if (storage) {
    storage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Test helper — clears persisted and in-memory device id. */
export function clearDeviceId(): void {
  memoryDeviceId = null;
  const storage = webStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
}

/** Test helper — force a known device id. */
export function setDeviceId(id: string): void {
  memoryDeviceId = id;
  const storage = webStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, id);
  }
}
