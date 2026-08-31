import { describe, expect, it, vi } from 'vitest';

import {
  bindActiveSyncDriver,
  cancelSync,
  getActiveSyncDriverForTests,
  refreshSync,
  requestSyncPush,
  unbindActiveSyncDriver,
} from './activeDriver';
import type { PowerSavingDriver } from './powerSaving';

function fakeDriver(
  overrides: Partial<PowerSavingDriver> = {},
): PowerSavingDriver {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
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

  it('forwards cancellation to the bound driver', () => {
    const driver = fakeDriver();
    bindActiveSyncDriver(driver);

    cancelSync();

    expect(driver.cancel).toHaveBeenCalledOnce();
    unbindActiveSyncDriver(driver);
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
