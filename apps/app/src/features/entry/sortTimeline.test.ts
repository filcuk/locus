import { describe, expect, it } from 'vitest';

import { sortTimeline } from './types';
import type Note from '@/db/models/Note';
import type Comment from '@/db/models/Comment';

function note(partial: {
  id: string;
  createdAt: Date;
  visitedAt?: Date | null;
  body?: string | null;
}): Note {
  return {
    id: partial.id,
    createdAt: partial.createdAt,
    visitedAt: partial.visitedAt ?? null,
    body: partial.body ?? null,
  } as Note;
}

function comment(partial: { id: string; createdAt: Date; body: string }): Comment {
  return {
    id: partial.id,
    createdAt: partial.createdAt,
    body: partial.body,
  } as Comment;
}

describe('sortTimeline', () => {
  it('orders by visited_at / created_at descending', () => {
    const items = sortTimeline(
      [
        note({
          id: 'n1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          visitedAt: new Date('2024-01-01T00:00:00.000Z'),
        }),
        note({
          id: 'n2',
          createdAt: new Date('2024-03-01T00:00:00.000Z'),
          body: 'plain',
        }),
      ],
      [
        comment({
          id: 'c1',
          createdAt: new Date('2024-02-01T00:00:00.000Z'),
          body: 'hi',
        }),
      ],
    );
    expect(items.map((i) => (i.kind === 'note' ? i.note.id : i.comment.id))).toEqual([
      'n2',
      'c1',
      'n1',
    ]);
  });
});
