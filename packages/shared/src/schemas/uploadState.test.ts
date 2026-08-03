import { describe, expect, it } from 'vitest';

import {
  UPLOAD_STATE_TRANSITIONS,
  canTransitionUploadState,
} from './uploadState.js';
import type { UploadState } from './common.js';

describe('upload_state transitions (DESIGN §4 Photos / §5 hard part 7)', () => {
  it('documents the full transition table', () => {
    expect(UPLOAD_STATE_TRANSITIONS).toEqual({
      local_only: ['pending', 'failed'],
      pending: ['uploaded', 'failed', 'local_only'],
      uploaded: ['pending'],
      failed: ['pending', 'local_only'],
    });
  });

  it('allows staying in the same state', () => {
    const states: UploadState[] = ['local_only', 'pending', 'uploaded', 'failed'];
    for (const state of states) {
      expect(canTransitionUploadState(state, state)).toBe(true);
    }
  });

  it('allows the offline → queue → uploaded path', () => {
    expect(canTransitionUploadState('local_only', 'pending')).toBe(true);
    expect(canTransitionUploadState('pending', 'uploaded')).toBe(true);
  });

  it('rejects skipping pending from local_only to uploaded', () => {
    expect(canTransitionUploadState('local_only', 'uploaded')).toBe(false);
  });

  it('rejects regressing uploaded to local_only without re-queue', () => {
    expect(canTransitionUploadState('uploaded', 'local_only')).toBe(false);
    expect(canTransitionUploadState('uploaded', 'failed')).toBe(false);
  });
});
