import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bindSyncStatusHooks,
  getSyncStatusHooks,
  unbindSyncStatusHooks,
} from './status.js';

afterEach(() => {
  unbindSyncStatusHooks();
});

describe('sync status hooks binding', () => {
  it('defaults to no-ops until bound', () => {
    expect(() => getSyncStatusHooks().beginSynchronize()).not.toThrow();
  });

  it('forwards to the bound P1-F-compatible controller', () => {
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
});
