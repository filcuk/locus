/**
 * Map DESIGN §5 `server_seq` watermarks through WatermelonDB's `lastPulledAt`.
 *
 * WatermelonDB invariants require `timestamp > 0`. An empty ChangeLog returns
 * watermark `0`, so we use a fractional sentinel that:
 * - satisfies `timestamp > 0`
 * - round-trips via `parseInt` back to "never pulled" (`null`) for the next pull
 * - maps to API `cursor=0` on push/pull
 */

/** Stored in `__watermelon_last_pulled_at` when the server watermark is 0. */
export const EMPTY_WATERMARK_SENTINEL = 0.001;

export function toWatermelonTimestamp(serverSeq: number): number {
  if (serverSeq <= 0) return EMPTY_WATERMARK_SENTINEL;
  return serverSeq;
}

/** Convert WatermelonDB `lastPulledAt` (or null on first sync) to API cursor. */
export function toServerCursor(lastPulledAt: number | null | undefined): number {
  if (lastPulledAt == null || lastPulledAt < 1) return 0;
  return Math.floor(lastPulledAt);
}
