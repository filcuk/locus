import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMemorySecureStorage,
  setSecureStorageForTests,
} from '../auth/secureStorage.js';
import {
  clearServerUrl,
  getServerUrl,
  hasServerUrl,
  hydrateServerUrl,
  isValidServerUrl,
  resetServerUrlCacheForTests,
  setServerUrl,
} from './server-url';

beforeEach(() => {
  setSecureStorageForTests(createMemorySecureStorage());
  resetServerUrlCacheForTests();
});

afterEach(async () => {
  await clearServerUrl();
  setSecureStorageForTests(null);
  resetServerUrlCacheForTests();
});

describe('server-url', () => {
  it('rejects non-http(s) values', () => {
    expect(isValidServerUrl('not-a-url')).toBe(false);
    expect(isValidServerUrl('ftp://example.com')).toBe(false);
    expect(isValidServerUrl('https://example.com')).toBe(true);
    expect(isValidServerUrl('http://localhost:8000')).toBe(true);
  });

  it('stores and returns a trimmed URL without a trailing slash', async () => {
    await setServerUrl(' https://example.com/ ');
    expect(getServerUrl()).toBe('https://example.com');
    expect(hasServerUrl()).toBe(true);
  });

  it('starts empty — no baked-in instance', () => {
    expect(getServerUrl()).toBeNull();
    expect(hasServerUrl()).toBe(false);
  });

  it('persists via SecureStorage and survives a cold-start hydrate', async () => {
    await setServerUrl('https://persist.example');
    expect(getServerUrl()).toBe('https://persist.example');

    resetServerUrlCacheForTests();
    expect(getServerUrl()).toBeNull();
    expect(hasServerUrl()).toBe(false);

    await hydrateServerUrl();
    expect(getServerUrl()).toBe('https://persist.example');
    expect(hasServerUrl()).toBe(true);
  });

  it('hydrate is a no-op once the cache is warm', async () => {
    await setServerUrl('https://first.example');
    resetServerUrlCacheForTests();
    await hydrateServerUrl();
    await setServerUrl('https://second.example');
    // Second hydrate must not overwrite the in-memory value from storage.
    await hydrateServerUrl();
    expect(getServerUrl()).toBe('https://second.example');
  });

  it('clear removes both memory and SecureStorage', async () => {
    const storage = createMemorySecureStorage();
    setSecureStorageForTests(storage);
    await setServerUrl('https://gone.example');
    await clearServerUrl();
    expect(getServerUrl()).toBeNull();
    expect(await storage.getItem('locus.serverUrl')).toBeNull();
  });
});
