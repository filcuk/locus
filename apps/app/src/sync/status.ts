/**
 * Hooks into P1-F `syncStatusController` without owning indicator UI.
 * Bind the real controller when P1-F is on the tree; tests inject fakes.
 */

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

let bound: SyncStatusHooks = noopHooks;

/** Wire P1-F's `syncStatusController` (or a test double). */
export function bindSyncStatusHooks(hooks: SyncStatusHooks): void {
  bound = hooks;
}

export function unbindSyncStatusHooks(): void {
  bound = noopHooks;
}

export function getSyncStatusHooks(): SyncStatusHooks {
  return bound;
}
