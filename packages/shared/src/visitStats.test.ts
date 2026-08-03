import { describe, expect, it } from 'vitest';

import { visitStatsFromNotes } from './visitStats.js';

describe('visitStatsFromNotes', () => {
  it('ignores notes without visited_at', () => {
    expect(
      visitStatsFromNotes([{ visitedAt: null }, { visitedAt: undefined }]),
    ).toEqual({ visitCount: 0, lastVisitAt: null });
  });

  it('counts visits and picks the latest', () => {
    const earlier = new Date('2024-01-01T00:00:00.000Z');
    const later = new Date('2024-06-01T00:00:00.000Z');
    const stats = visitStatsFromNotes([
      { visitedAt: earlier },
      { visitedAt: null },
      { visitedAt: later.toISOString() },
    ]);
    expect(stats.visitCount).toBe(2);
    expect(stats.lastVisitAt?.toISOString()).toBe(later.toISOString());
  });
});
