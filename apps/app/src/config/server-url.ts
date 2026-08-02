/**
 * User-configurable instance URL. Never hardcode a host — every Locus
 * deployment is self-hosted (DESIGN §8, AGENTS §4).
 *
 * Persistence: localStorage on web when available; in-memory otherwise until a
 * native store lands with the Android toolchain.
 */

const STORAGE_KEY = 'locus.serverUrl';

let memoryUrl: string | null = null;

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

export function getServerUrl(): string | null {
  const storage = webStorage();
  if (storage) {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored !== null && stored.length > 0) return stored;
  }
  return memoryUrl;
}

export function hasServerUrl(): boolean {
  const url = getServerUrl();
  return url !== null && url.length > 0;
}

export function setServerUrl(url: string): void {
  const normalised = url.trim().replace(/\/+$/, '');
  memoryUrl = normalised;
  const storage = webStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, normalised);
  }
}

export function clearServerUrl(): void {
  memoryUrl = null;
  const storage = webStorage();
  if (storage) {
    storage.removeItem(STORAGE_KEY);
  }
}

/** Accept only http(s) absolute URLs; reject anything else. */
export function isValidServerUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
