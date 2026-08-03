import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestForegroundPermissionsAsync = vi.fn();
const getCurrentPositionAsync = vi.fn();

vi.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: (...args: unknown[]) =>
    requestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => getCurrentPositionAsync(...args),
}));

import { requestOneShotFix } from './requestOneShotFix';

describe('requestOneShotFix', () => {
  beforeEach(() => {
    requestForegroundPermissionsAsync.mockReset();
    getCurrentPositionAsync.mockReset();
  });

  it('returns null when foreground permission is denied', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });
    await expect(requestOneShotFix()).resolves.toBeNull();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('returns a LatLon fix after a granted one-shot read', async () => {
    requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    getCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: 51.5, longitude: -0.12 },
    });
    await expect(requestOneShotFix()).resolves.toEqual({ lat: 51.5, lon: -0.12 });
    expect(getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: 3 });
  });
});
