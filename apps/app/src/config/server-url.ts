/**
 * User-configurable instance URL. Never hardcode a host — every Locus
 * deployment is self-hosted (DESIGN §8, AGENTS §4).
 *
 * Persistence uses the same SecureStorage as auth tokens / device_id
 * (`expo-secure-store` on native, localStorage on web). Call
 * `hydrateServerUrl()` once at boot before reading; sync getters then
 * serve the in-memory cache so call sites stay unified.
 */

import { getSecureStorage } from '../auth/secureStorage.js';

const STORAGE_KEY = 'locus.serverUrl';

let memoryUrl: string | null = null;
let hydrateInFlight: Promise<void> | null = null;
let hydrated = false;

function normaliseServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Load any persisted URL into memory. Safe to call repeatedly; concurrent
 * callers share one in-flight read. Must run before the boot gate's
 * `hasServerUrl()` check so native cold starts restore the instance.
 */
export async function hydrateServerUrl(): Promise<void> {
  if (hydrated) return;
  if (hydrateInFlight) {
    await hydrateInFlight;
    return;
  }
  hydrateInFlight = (async () => {
    const stored = await getSecureStorage().getItem(STORAGE_KEY);
    if (stored !== null && stored.length > 0) {
      memoryUrl = stored;
    }
    hydrated = true;
  })();
  try {
    await hydrateInFlight;
  } finally {
    hydrateInFlight = null;
  }
}

export function getServerUrl(): string | null {
  return memoryUrl;
}

export function hasServerUrl(): boolean {
  const url = getServerUrl();
  return url !== null && url.length > 0;
}

export async function setServerUrl(url: string): Promise<void> {
  const normalised = normaliseServerUrl(url);
  memoryUrl = normalised;
  hydrated = true;
  await getSecureStorage().setItem(STORAGE_KEY, normalised);
}

export async function clearServerUrl(): Promise<void> {
  memoryUrl = null;
  hydrated = true;
  await getSecureStorage().deleteItem(STORAGE_KEY);
}

/** Test helper — simulates process death (memory gone, SecureStorage intact). */
export function resetServerUrlCacheForTests(): void {
  memoryUrl = null;
  hydrated = false;
  hydrateInFlight = null;
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
