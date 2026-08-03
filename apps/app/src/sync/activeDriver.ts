/**
 * Process-wide handle for the signed-in power-saving driver.
 * Writers call `requestSyncPush` without importing React; the provider owns
 * start/stop. Never wipe local data if no driver is bound (signed out).
 */

import type { PowerSavingDriver } from './powerSaving.js';

let active: PowerSavingDriver | null = null;

export function bindActiveSyncDriver(driver: PowerSavingDriver): void {
  active = driver;
}

export function unbindActiveSyncDriver(driver: PowerSavingDriver): void {
  if (active === driver) {
    active = null;
  }
}

/** Debounced push after a local write (no-op when signed out). */
export function requestSyncPush(): void {
  active?.requestPush();
}

/** Immediate synchronize — pull-to-refresh / explicit. */
export function refreshSync(): Promise<void> {
  return active?.refresh() ?? Promise.resolve();
}

/** Test helper. */
export function getActiveSyncDriverForTests(): PowerSavingDriver | null {
  return active;
}
