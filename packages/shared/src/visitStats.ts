/**
 * Per-viewer visit stats derived from notes (DESIGN §4 / §8).
 * A note with `visited_at` is a visit; counts are never stored.
 */

export type VisitNoteLike = {
  visitedAt: Date | string | number | null | undefined;
};

export type VisitStats = {
  visitCount: number;
  lastVisitAt: Date | null;
};

function toDate(value: VisitNoteLike['visitedAt']): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string' && value.length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Derive visit count and last visit from the viewer's notes on one target. */
export function visitStatsFromNotes(
  notes: ReadonlyArray<VisitNoteLike>,
): VisitStats {
  let visitCount = 0;
  let lastVisitAt: Date | null = null;
  for (const note of notes) {
    const at = toDate(note.visitedAt);
    if (at == null) continue;
    visitCount += 1;
    if (lastVisitAt == null || at.getTime() > lastVisitAt.getTime()) {
      lastVisitAt = at;
    }
  }
  return { visitCount, lastVisitAt };
}
