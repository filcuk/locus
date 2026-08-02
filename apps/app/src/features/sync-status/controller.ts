import { deriveSyncIndicatorState } from './derive.js';
import type { SyncPhase, SyncStatusSnapshot } from './types.js';

type Listener = (snapshot: SyncStatusSnapshot) => void;

type ControllerState = {
  online: boolean;
  paused: boolean;
  phase: SyncPhase;
  liveConnected: boolean;
  lastError: string | null;
};

function snapshotOf(state: ControllerState): SyncStatusSnapshot {
  return {
    ...state,
    state: deriveSyncIndicatorState(state),
  };
}

/**
 * Process-wide sync status for the indicator and (later) the synchronize() driver.
 * Does not perform network I/O — P1-D owns WatermelonDB synchronize().
 */
export function createSyncStatusController(
  initial: Partial<ControllerState> = {},
): {
  getSnapshot: () => SyncStatusSnapshot;
  subscribe: (listener: Listener) => () => void;
  setOnline: (online: boolean) => void;
  setPaused: (paused: boolean) => void;
  beginSynchronize: () => void;
  endSynchronize: (result?: { ok: boolean; errorMessage?: string }) => void;
  reportError: (message: string) => void;
  clearError: () => void;
  /** P5 stub — call when a live WebSocket is up; leave false until then. */
  setLiveConnected: (connected: boolean) => void;
  reset: () => void;
} {
  let state: ControllerState = {
    online: initial.online ?? true,
    paused: initial.paused ?? false,
    phase: initial.phase ?? 'idle',
    liveConnected: initial.liveConnected ?? false,
    lastError: initial.lastError ?? null,
  };
  const listeners = new Set<Listener>();

  const emit = (): void => {
    const snap = snapshotOf(state);
    for (const listener of listeners) {
      listener(snap);
    }
  };

  const assign = (patch: Partial<ControllerState>): void => {
    state = { ...state, ...patch };
    emit();
  };

  return {
    getSnapshot: () => snapshotOf(state),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOnline: (online) => {
      assign({ online });
    },
    setPaused: (paused) => {
      assign({ paused });
    },
    beginSynchronize: () => {
      assign({ phase: 'syncing' });
    },
    endSynchronize: (result) => {
      if (result === undefined || result.ok) {
        assign({ phase: 'idle', lastError: null });
        return;
      }
      assign({
        phase: 'idle',
        lastError: result.errorMessage ?? 'Sync failed',
      });
    },
    reportError: (message) => {
      assign({ lastError: message, phase: 'idle' });
    },
    clearError: () => {
      assign({ lastError: null });
    },
    setLiveConnected: (connected) => {
      assign({ liveConnected: connected });
    },
    reset: () => {
      state = {
        online: true,
        paused: false,
        phase: 'idle',
        liveConnected: false,
        lastError: null,
      };
      emit();
    },
  };
}

export type SyncStatusController = ReturnType<typeof createSyncStatusController>;

/** Shared controller used by the provider and callable from the sync driver. */
export const syncStatusController = createSyncStatusController();
