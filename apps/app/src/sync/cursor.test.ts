import { describe, expect, it } from 'vitest';

import {
  EMPTY_WATERMARK_SENTINEL,
  toServerCursor,
  toWatermelonTimestamp,
} from './cursor.js';

describe('server_seq ↔ lastPulledAt cursor mapping', () => {
  it('uses a positive sentinel for empty watermark 0', () => {
    expect(toWatermelonTimestamp(0)).toBe(EMPTY_WATERMARK_SENTINEL);
    expect(toWatermelonTimestamp(0)).toBeGreaterThan(0);
  });

  it('passes through positive server_seq unchanged', () => {
    expect(toWatermelonTimestamp(41822)).toBe(41822);
  });

  it('maps null / sentinel / sub-1 back to API cursor 0', () => {
    expect(toServerCursor(null)).toBe(0);
    expect(toServerCursor(undefined)).toBe(0);
    expect(toServerCursor(EMPTY_WATERMARK_SENTINEL)).toBe(0);
    expect(toServerCursor(0.5)).toBe(0);
  });

  it('floors positive watermelondb timestamps to int cursors', () => {
    expect(toServerCursor(41822)).toBe(41822);
    expect(toServerCursor(41822.9)).toBe(41822);
  });
});
