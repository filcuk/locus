import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useState } from 'react';

import type Collection from '@/db/models/Collection';
import type CollectionItem from '@/db/models/CollectionItem';

import type { CollectionListRow } from './types';

const notDeleted = Q.where('deleted_at', null);

/** Observes non-deleted collections and live membership counts. */
export function useCollectionsList(): {
  rows: CollectionListRow[];
  loading: boolean;
} {
  const database = useDatabase();
  const [rows, setRows] = useState<CollectionListRow[] | null>(null);

  useEffect(() => {
    let collections: Collection[] = [];
    let items: CollectionItem[] = [];
    let collectionsReady = false;
    let itemsReady = false;

    const emit = () => {
      if (!collectionsReady || !itemsReady) return;
      const counts = new Map<string, number>();
      for (const item of items) {
        counts.set(item.collectionId, (counts.get(item.collectionId) ?? 0) + 1);
      }
      const next = collections
        .map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.getTime(),
          memberCount: counts.get(c.id) ?? 0,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setRows(next);
    };

    const collectionsSub = database
      .get<Collection>('collections')
      .query(notDeleted)
      .observe()
      .subscribe((list) => {
        collections = list;
        collectionsReady = true;
        emit();
      });
    const itemsSub = database
      .get<CollectionItem>('collection_items')
      .query(notDeleted)
      .observe()
      .subscribe((list) => {
        items = list;
        itemsReady = true;
        emit();
      });

    return () => {
      collectionsSub.unsubscribe();
      itemsSub.unsubscribe();
    };
  }, [database]);

  return { rows: rows ?? [], loading: rows === null };
}
