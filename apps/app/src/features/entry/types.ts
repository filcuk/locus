import type { TargetType } from '@locus/shared';

import type Comment from '@/db/models/Comment';
import type Note from '@/db/models/Note';

export type EntryKind = 'area' | 'place' | 'point';

export type EntryTimelineItem =
  | { kind: 'note'; note: Note }
  | { kind: 'comment'; comment: Comment };

export function toTargetType(kind: EntryKind): TargetType {
  return kind;
}

export function sortTimeline(
  notes: ReadonlyArray<Note>,
  comments: ReadonlyArray<Comment>,
): EntryTimelineItem[] {
  const items: EntryTimelineItem[] = [
    ...notes.map((note) => ({ kind: 'note' as const, note })),
    ...comments.map((comment) => ({ kind: 'comment' as const, comment })),
  ];
  items.sort((a, b) => {
    const aAt =
      a.kind === 'note'
        ? (a.note.visitedAt ?? a.note.createdAt).getTime()
        : a.comment.createdAt.getTime();
    const bAt =
      b.kind === 'note'
        ? (b.note.visitedAt ?? b.note.createdAt).getTime()
        : b.comment.createdAt.getTime();
    return bAt - aAt;
  });
  return items;
}
