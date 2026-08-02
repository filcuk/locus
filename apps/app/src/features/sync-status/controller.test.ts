import { describe, expect, it, vi } from 'vitest';

import { createSyncStatusController } from './controller.js';

describe('syncStatusController', () => {
  it('tracks synchronize() lifecycle without wiping prior offline flags incorrectly', () => {
    const c = createSyncStatusController({ online: true });
    c.beginSynchronize();
    expect(c.getSnapshot().state).toBe('syncing');
    c.endSynchronize({ ok: true });
    expect(c.getSnapshot().state).toBe('idle');
    expect(c.getSnapshot().lastError).toBeNull();
  });

  it('surfaces driver failures as Error and keeps local data concerns out of scope', () => {
    const c = createSyncStatusController();
    c.beginSynchronize();
    c.endSynchronize({ ok: false, errorMessage: 'pull rejected' });
    expect(c.getSnapshot().state).toBe('error');
    expect(c.getSnapshot().lastError).toBe('pull rejected');
    expect(c.getSnapshot().phase).toBe('idle');
  });

  it('gates Live until setLiveConnected(true)', () => {
    const c = createSyncStatusController();
    expect(c.getSnapshot().state).toBe('idle');
    c.setLiveConnected(true);
    expect(c.getSnapshot().state).toBe('live');
    c.setLiveConnected(false);
    expect(c.getSnapshot().state).toBe('idle');
  });

  it('notifies subscribers on change', () => {
    const c = createSyncStatusController();
    const spy = vi.fn();
    const unsub = c.subscribe(spy);
    c.setOnline(false);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.at(-1)?.[0]?.state).toBe('offline');
    unsub();
    c.setOnline(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
