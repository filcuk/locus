import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useState } from 'react';

import type Tagging from '@/db/models/Tagging';

import type { EntryKind } from '@/features/entry/types';

const notDeleted = Q.where('deleted_at', null);

export type EntryTagChip = {
  id: string;
  label: string;
  colour: string | null;
  scope: string;
  namespace: string | null;
};

/**
 * Taggings on an entry — chips use denormalised fields so another user's
 * private tag label can render without catalog membership (DESIGN §4 / §8).
 */
export function useEntryTagChips(
  kind: EntryKind,
  id: string,
): { chips: EntryTagChip[]; loading: boolean } {
  const database = useDatabase();
  const [chips, setChips] = useState<EntryTagChip[] | null>(null);

  useEffect(() => {
    if (!id) {
      setChips([]);
      return;
    }
    const sub = database
      .get<Tagging>('taggings')
      .query(
        Q.where('target_type', kind),
        Q.where('target_id', id),
        notDeleted,
      )
      .observe()
      .subscribe((rows) => {
        setChips(
          rows.map((row) => ({
            id: row.id,
            label: row.tagLabel || row.tagId,
            colour: row.tagColour,
            scope: row.tagScope || 'system',
            namespace: row.tagNamespace,
          })),
        );
      });
    return () => sub.unsubscribe();
  }, [database, kind, id]);

  return { chips: chips ?? [], loading: chips === null };
}
