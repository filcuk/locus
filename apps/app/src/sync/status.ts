/**
 * Hooks into P1-F `syncStatusController` without owning indicator UI.
 * Defaults to the shared singleton; tests may rebind or call silenceSyncStatusHooks().
 */

import { syncStatusController } from '../features/sync-status/controller';

export type SyncStatusHooks = {
  beginSynchronize: () => void;
  endSynchronize: (result?: { ok: boolean; errorMessage?: string }) => void;
  reportError: (message: string) => void;
};

const noopHooks: SyncStatusHooks = {
  beginSynchronize: () => undefined,
  endSynchronize: () => undefined,
  reportError: () => undefined,
};

function hooksFromController(): SyncStatusHooks {
  return {
    beginSynchronize: () => {
      syncStatusController.beginSynchronize();
    },
    endSynchronize: (result) => {
      syncStatusController.endSynchronize(result);
    },
    reportError: (message) => {
      syncStatusController.reportError(message);
    },
  };
}

let bound: SyncStatusHooks = hooksFromController();

/** Wire P1-F's `syncStatusController` (or a test double). */
export function bindSyncStatusHooks(hooks: SyncStatusHooks): void {
  bound = hooks;
}

/** Restore the default P1-F singleton binding. */
export function unbindSyncStatusHooks(): void {
  bound = hooksFromController();
}

/** Test helper — silence status updates (no controller side effects). */
export function silenceSyncStatusHooks(): void {
  bound = noopHooks;
}

export function getSyncStatusHooks(): SyncStatusHooks {
  return bound;
}
