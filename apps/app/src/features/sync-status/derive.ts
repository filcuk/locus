import type { SyncIndicatorState, SyncPhase } from './types';

export type DeriveSyncStatusInput = {
  online: boolean;
  paused: boolean;
  phase: SyncPhase;
  liveConnected: boolean;
  lastError: string | null;
};

/**
 * Resolve the chrome label. Syncing wins so an in-flight pass is always visible;
 * offline/paused beats a stale error; Live only when a socket is marked up (P5).
 */
export function deriveSyncIndicatorState(input: DeriveSyncStatusInput): SyncIndicatorState {
  if (input.phase === 'syncing') {
    return 'syncing';
  }
  if (!input.online || input.paused) {
    return 'offline';
  }
  if (input.lastError !== null) {
    return 'error';
  }
  if (input.liveConnected) {
    return 'live';
  }
  return 'idle';
}
