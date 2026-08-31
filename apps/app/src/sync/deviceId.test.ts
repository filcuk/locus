import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMemorySecureStorage,
  setSecureStorageForTests,
} from '../auth/secureStorage';
import { clearDeviceId, getDeviceId, setDeviceId } from './deviceId';

beforeEach(() => {
  setSecureStorageForTests(createMemorySecureStorage());
});

afterEach(async () => {
  await clearDeviceId();
  setSecureStorageForTests(null);
});

describe('getDeviceId', () => {
  it('returns a stable id across calls', async () => {
    const a = await getDeviceId();
    const b = await getDeviceId();
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('honours setDeviceId for tests', async () => {
    await setDeviceId('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1');
    await expect(getDeviceId()).resolves.toBe(
      'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
    );
  });
});
