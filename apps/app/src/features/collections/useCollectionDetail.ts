import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useMemo, useState } from 'react';

import type Area from '@/db/models/Area';
import type Collection from '@/db/models/Collection';
import type CollectionItem from '@/db/models/CollectionItem';
import type Place from '@/db/models/Place';
import type Point from '@/db/models/Point';

import type {
  AddableEntry,
  CollectionMemberKind,
  CollectionMemberRow,
} from './types';

const notDeleted = Q.where('deleted_at', null);

/**
 * Observes one collection's memberships plus local entries available to add.
 */
export function useCollectionDetail(collectionId: string): {
  collection: Collection | null;
  members: CollectionMemberRow[];
  addable: AddableEntry[];
  loading: boolean;
} {
  const database = useDatabase();
  const [collection, setCollection] = useState<Collection | null | undefined>(
    undefined,
  );
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    const collectionSub = database
      .get<Collection>('collections')
      .query(Q.where('id', collectionId), notDeleted)
      .observe()
      .subscribe((rows) => {
        setCollection(rows[0] ?? null);
      });
    const itemsSub = database
      .get<CollectionItem>('collection_items')
      .query(Q.where('collection_id', collectionId), notDeleted)
      .observe()
      .subscribe(setItems);
    const areasSub = database
      .get<Area>('areas')
      .query(notDeleted)
      .observe()
      .subscribe(setAreas);
    const placesSub = database
      .get<Place>('places')
      .query(notDeleted)
      .observe()
      .subscribe(setPlaces);
    const pointsSub = database
      .get<Point>('points')
      .query(notDeleted)
      .observe()
      .subscribe(setPoints);

    return () => {
      collectionSub.unsubscribe();
      itemsSub.unsubscribe();
      areasSub.unsubscribe();
      placesSub.unsubscribe();
      pointsSub.unsubscribe();
    };
  }, [database, collectionId]);

  const titleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of areas ?? []) map.set(keyOf('area', a.id), a.title);
    for (const p of places ?? []) map.set(keyOf('place', p.id), p.title);
    for (const p of points ?? []) map.set(keyOf('point', p.id), p.title);
    return map;
  }, [areas, places, points]);

  const members: CollectionMemberRow[] = useMemo(() => {
    if (!items) return [];
    return items
      .map((item) => {
        const itemType = item.itemType as CollectionMemberKind;
        return {
          membershipId: item.id,
          itemType,
          itemId: item.itemId,
          title: titleByKey.get(keyOf(itemType, item.itemId)) ?? item.itemId,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items, titleByKey]);

  const memberKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) set.add(keyOf(m.itemType, m.itemId));
    return set;
  }, [members]);

  const addable: AddableEntry[] = useMemo(() => {
    if (areas === null || places === null || points === null) return [];
    const out: AddableEntry[] = [];
    for (const a of areas) {
      if (!memberKeys.has(keyOf('area', a.id))) {
        out.push({ itemType: 'area', itemId: a.id, title: a.title });
      }
    }
    for (const p of places) {
      if (!memberKeys.has(keyOf('place', p.id))) {
        out.push({ itemType: 'place', itemId: p.id, title: p.title });
      }
    }
    for (const p of points) {
      if (!memberKeys.has(keyOf('point', p.id))) {
        out.push({ itemType: 'point', itemId: p.id, title: p.title });
      }
    }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  }, [areas, places, points, memberKeys]);

  const loading =
    collection === undefined ||
    items === null ||
    areas === null ||
    places === null ||
    points === null;

  return {
    collection: collection ?? null,
    members,
    addable,
    loading,
  };
}

function keyOf(kind: CollectionMemberKind, id: string): string {
  return `${kind}:${id}`;
}
