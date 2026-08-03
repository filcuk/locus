import { afterEach, describe, expect, it } from 'vitest';

import { clearDeviceId, getDeviceId, setDeviceId } from './deviceId';

afterEach(() => {
  clearDeviceId();
});

describe('getDeviceId', () => {
  it('returns a stable id across calls', () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('honours setDeviceId for tests', () => {
    setDeviceId('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1');
    expect(getDeviceId()).toBe('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1');
  });
});
