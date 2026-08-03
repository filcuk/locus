/**
 * Photo `upload_state` machine (DESIGN §4 Photos / §5 hard part 7).
 * Metadata may precede bytes; clients gate rendering on these states.
 * Byte upload / queue transitions are enforced here so P3-B shares one table.
 */
import type { UploadState } from './common.js';

/** Allowed next states from each current state (same-state is always ok). */
export const UPLOAD_STATE_TRANSITIONS: Record<
  UploadState,
  readonly UploadState[]
> = {
  local_only: ['pending', 'failed'],
  pending: ['uploaded', 'failed', 'local_only'],
  uploaded: ['pending'],
  failed: ['pending', 'local_only'],
};

export function canTransitionUploadState(
  from: UploadState,
  to: UploadState,
): boolean {
  if (from === to) return true;
  return UPLOAD_STATE_TRANSITIONS[from].includes(to);
}
