import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearDeviceIdForTests,
  createMemorySecureStorage,
  getOrCreateDeviceId,
  setSecureStorageForTests,
} from './index';

beforeEach(() => {
  setSecureStorageForTests(createMemorySecureStorage());
});

afterEach(async () => {
  await clearDeviceIdForTests();
  setSecureStorageForTests(null);
});

describe('deviceId', () => {
  it('creates once and reuses the same id', async () => {
    const first = await getOrCreateDeviceId();
    const second = await getOrCreateDeviceId();
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(10);
  });
});
