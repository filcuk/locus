import { describe, expect, it } from 'vitest';

import { deriveSyncIndicatorState } from './derive.js';

const base = {
  online: true,
  paused: false,
  phase: 'idle' as const,
  liveConnected: false,
  lastError: null as string | null,
};

describe('deriveSyncIndicatorState', () => {
  it('shows Syncing while a synchronize() pass is in flight', () => {
    expect(deriveSyncIndicatorState({ ...base, phase: 'syncing', lastError: 'stale' })).toBe('syncing');
  });

  it('shows Offline when there is no network', () => {
    expect(deriveSyncIndicatorState({ ...base, online: false })).toBe('offline');
  });

  it('shows Offline when sync is paused', () => {
    expect(deriveSyncIndicatorState({ ...base, paused: true })).toBe('offline');
  });

  it('prefers Offline over a stale error when disconnected', () => {
    expect(
      deriveSyncIndicatorState({
        ...base,
        online: false,
        lastError: 'push failed',
      }),
    ).toBe('offline');
  });

  it('shows Error after a driver failure while online', () => {
    expect(deriveSyncIndicatorState({ ...base, lastError: 'push failed' })).toBe('error');
  });

  it('shows Live only when a live socket is marked connected (P5 stub)', () => {
    expect(deriveSyncIndicatorState({ ...base, liveConnected: true })).toBe('live');
    expect(deriveSyncIndicatorState(base)).toBe('idle');
  });
});
