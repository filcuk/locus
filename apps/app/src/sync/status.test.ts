import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncStatusController } from '../features/sync-status/controller';
import {
  bindSyncStatusHooks,
  getSyncStatusHooks,
  silenceSyncStatusHooks,
  unbindSyncStatusHooks,
} from './status';

afterEach(() => {
  unbindSyncStatusHooks();
  syncStatusController.reset();
});

describe('sync status hooks binding', () => {
  it('defaults to the P1-F syncStatusController singleton', () => {
    syncStatusController.reset();
    getSyncStatusHooks().beginSynchronize();
    expect(syncStatusController.getSnapshot().phase).toBe('syncing');

    getSyncStatusHooks().endSynchronize({ ok: true });
    expect(syncStatusController.getSnapshot().phase).toBe('idle');
    expect(syncStatusController.getSnapshot().lastError).toBeNull();
  });

  it('forwards to a bound test double', () => {
    const beginSynchronize = vi.fn();
    const endSynchronize = vi.fn();
    const reportError = vi.fn();
    bindSyncStatusHooks({ beginSynchronize, endSynchronize, reportError });

    const hooks = getSyncStatusHooks();
    hooks.beginSynchronize();
    hooks.endSynchronize({ ok: true });
    hooks.reportError('x');

    expect(beginSynchronize).toHaveBeenCalledOnce();
    expect(endSynchronize).toHaveBeenCalledWith({ ok: true });
    expect(reportError).toHaveBeenCalledWith('x');
  });

  it('silenceSyncStatusHooks installs no-ops', () => {
    silenceSyncStatusHooks();
    expect(() => getSyncStatusHooks().beginSynchronize()).not.toThrow();
    expect(syncStatusController.getSnapshot().phase).toBe('idle');
  });
});
