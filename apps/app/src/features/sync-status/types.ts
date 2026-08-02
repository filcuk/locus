/**
 * Visible sync indicator states (DESIGN §8 point 3).
 * `idle` is the quiet power-saving rest state (online, not syncing, not live, no error).
 * `live` is gated until P5 WebSocket hints — only when explicitly marked connected.
 */
export type SyncIndicatorState = 'offline' | 'syncing' | 'live' | 'error' | 'idle';

export type SyncPhase = 'idle' | 'syncing';

export type SyncStatusSnapshot = {
  online: boolean;
  /** Operator/user paused sync — treated as Offline. */
  paused: boolean;
  phase: SyncPhase;
  /** P5 stub: true only when a live socket is reported connected. */
  liveConnected: boolean;
  /** Last sync-driver failure message; cleared on the next successful end. */
  lastError: string | null;
  state: SyncIndicatorState;
};
