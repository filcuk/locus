import { describe, expect, it, vi } from 'vitest';

import {
  bindActiveSyncDriver,
  getActiveSyncDriverForTests,
  refreshSync,
  requestSyncPush,
  unbindActiveSyncDriver,
} from './activeDriver.js';
import type { PowerSavingDriver } from './powerSaving.js';

function fakeDriver(
  overrides: Partial<PowerSavingDriver> = {},
): PowerSavingDriver {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    requestPush: vi.fn(),
    refresh: vi.fn(async () => undefined),
    isSyncing: vi.fn(() => false),
    ...overrides,
  };
}

describe('activeDriver registry', () => {
  it('requestSyncPush is a no-op when unbound', () => {
    const orphan = fakeDriver();
    unbindActiveSyncDriver(orphan);
    expect(() => requestSyncPush()).not.toThrow();
  });

  it('forwards requestPush and refresh to the bound driver', async () => {
    const driver = fakeDriver();
    bindActiveSyncDriver(driver);
    expect(getActiveSyncDriverForTests()).toBe(driver);

    requestSyncPush();
    expect(driver.requestPush).toHaveBeenCalledOnce();

    await refreshSync();
    expect(driver.refresh).toHaveBeenCalledOnce();

    unbindActiveSyncDriver(driver);
    expect(getActiveSyncDriverForTests()).toBeNull();
  });

  it('unbind of a different driver leaves the active binding', () => {
    const a = fakeDriver();
    const b = fakeDriver();
    bindActiveSyncDriver(a);
    unbindActiveSyncDriver(b);
    expect(getActiveSyncDriverForTests()).toBe(a);
    unbindActiveSyncDriver(a);
  });
});
