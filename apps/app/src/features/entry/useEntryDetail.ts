import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { visitStatsFromNotes } from '@locus/shared';
import { useEffect, useMemo, useState } from 'react';

import type Area from '@/db/models/Area';
import type Comment from '@/db/models/Comment';
import type Note from '@/db/models/Note';
import type Place from '@/db/models/Place';
import type Point from '@/db/models/Point';

import { sortTimeline, type EntryKind, type EntryTimelineItem } from './types';

const notDeleted = Q.where('deleted_at', null);

export type EntryRecord =
  | { kind: 'area'; row: Area }
  | { kind: 'place'; row: Place }
  | { kind: 'point'; row: Point };

/**
 * Observes one entry plus its personal notes and collaborative comments (DESIGN §8).
 */
export function useEntryDetail(
  kind: EntryKind,
  id: string,
): {
  entry: EntryRecord | null;
  notes: Note[];
  comments: Comment[];
  timeline: EntryTimelineItem[];
  visitCount: number;
  lastVisitAt: Date | null;
  loading: boolean;
} {
  const database = useDatabase();
  const [entry, setEntry] = useState<EntryRecord | null | undefined>(undefined);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);

  useEffect(() => {
    const table =
      kind === 'area' ? 'areas' : kind === 'place' ? 'places' : 'points';
    const entrySub = database
      .get(table)
      .query(Q.where('id', id), notDeleted)
      .observe()
      .subscribe((rows) => {
        const row = rows[0];
        if (!row) {
          setEntry(null);
          return;
        }
        if (kind === 'area') setEntry({ kind, row: row as Area });
        else if (kind === 'place') setEntry({ kind, row: row as Place });
        else setEntry({ kind, row: row as Point });
      });

    const notesSub = database
      .get<Note>('notes')
      .query(
        Q.where('target_type', kind),
        Q.where('target_id', id),
        notDeleted,
      )
      .observe()
      .subscribe(setNotes);

    const commentsSub = database
      .get<Comment>('comments')
      .query(
        Q.where('target_type', kind),
        Q.where('target_id', id),
        notDeleted,
      )
      .observe()
      .subscribe(setComments);

    return () => {
      entrySub.unsubscribe();
      notesSub.unsubscribe();
      commentsSub.unsubscribe();
    };
  }, [database, kind, id]);

  const timeline = useMemo(
    () => sortTimeline(notes ?? [], comments ?? []),
    [notes, comments],
  );

  const visits = useMemo(
    () => visitStatsFromNotes(notes ?? []),
    [notes],
  );

  const loading = entry === undefined || notes === null || comments === null;

  return {
    entry: entry ?? null,
    notes: notes ?? [],
    comments: comments ?? [],
    timeline,
    visitCount: visits.visitCount,
    lastVisitAt: visits.lastVisitAt,
    loading,
  };
}
