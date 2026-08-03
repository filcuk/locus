import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useMemo, useState } from 'react';

import { getSessionUser } from '@/auth';
import type Area from '@/db/models/Area';
import type Collection from '@/db/models/Collection';
import type Place from '@/db/models/Place';
import type Point from '@/db/models/Point';
import type Tag from '@/db/models/Tag';
import type Tagging from '@/db/models/Tagging';

import { isTagVisibleToViewer, matchSearch } from './matchSearch';
import type { SearchKind, SearchResult, SearchableRecord } from './types';

const notDeleted = Q.where('deleted_at', null);

type EntrySlice = {
  areas: Area[];
  places: Place[];
  points: Point[];
  collections: Collection[];
  tags: Tag[];
  taggings: Tagging[];
};

function emptySlice(): EntrySlice {
  return {
    areas: [],
    places: [],
    points: [],
    collections: [],
    tags: [],
    taggings: [],
  };
}

function tagKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}

function buildRecords(
  slice: EntrySlice,
  viewerId: string | null,
): SearchableRecord[] {
  const visibleTagById = new Map<string, Tag>();
  for (const tag of slice.tags) {
    if (
      isTagVisibleToViewer(
        { scope: tag.scope, ownerId: tag.ownerId },
        viewerId,
      )
    ) {
      visibleTagById.set(tag.id, tag);
    }
  }

  const labelsByTarget = new Map<string, string[]>();
  for (const tagging of slice.taggings) {
    const tag = visibleTagById.get(tagging.tagId);
    if (!tag) continue;
    const key = tagKey(tagging.targetType, tagging.targetId);
    const list = labelsByTarget.get(key) ?? [];
    list.push(tag.label);
    labelsByTarget.set(key, list);
  }

  const push = (
    out: SearchableRecord[],
    kind: SearchKind,
    id: string,
    title: string,
    description: string | null,
    updatedAt: number,
  ) => {
    out.push({
      id,
      kind,
      title,
      description,
      updatedAt,
      tagLabels: labelsByTarget.get(tagKey(kind, id)) ?? [],
    });
  };

  const out: SearchableRecord[] = [];
  for (const row of slice.areas) {
    push(
      out,
      'area',
      row.id,
      row.title,
      row.description,
      row.updatedAt.getTime(),
    );
  }
  for (const row of slice.places) {
    push(
      out,
      'place',
      row.id,
      row.title,
      row.description,
      row.updatedAt.getTime(),
    );
  }
  for (const row of slice.points) {
    push(
      out,
      'point',
      row.id,
      row.title,
      row.description,
      row.updatedAt.getTime(),
    );
  }
  for (const row of slice.collections) {
    push(
      out,
      'collection',
      row.id,
      row.title,
      row.description,
      row.updatedAt.getTime(),
    );
  }
  return out;
}

/**
 * Observes local WatermelonDB and filters in memory — UI never fetches
 * (offline-first / DESIGN §8). ACL for entries is enforced at sync pull;
 * private tags are filtered here per viewer.
 */
export function useSearchResults(query: string): {
  results: SearchResult[];
  loading: boolean;
} {
  const database = useDatabase();
  const [slice, setSlice] = useState<EntrySlice | null>(null);
  const [viewerId, setViewerId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void getSessionUser().then((user) => {
      if (!cancelled) setViewerId(user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let next = emptySlice();
    const ready = {
      areas: false,
      places: false,
      points: false,
      collections: false,
      tags: false,
      taggings: false,
    };

    const emit = () => {
      if (!Object.values(ready).every(Boolean)) return;
      setSlice({ ...next });
    };

    const subs = [
      database
        .get<Area>('areas')
        .query(notDeleted)
        .observe()
        .subscribe((list) => {
          next = { ...next, areas: list };
          ready.areas = true;
          emit();
        }),
      database
        .get<Place>('places')
        .query(notDeleted)
        .observe()
        .subscribe((list) => {
          next = { ...next, places: list };
          ready.places = true;
          emit();
        }),
      database
        .get<Point>('points')
        .query(notDeleted)
        .observe()
        .subscribe((list) => {
          next = { ...next, points: list };
          ready.points = true;
          emit();
        }),
      database
        .get<Collection>('collections')
        .query(notDeleted)
        .observe()
        .subscribe((list) => {
          next = { ...next, collections: list };
          ready.collections = true;
          emit();
        }),
      database
        .get<Tag>('tags')
        .query()
        .observe()
        .subscribe((list) => {
          next = { ...next, tags: list };
          ready.tags = true;
          emit();
        }),
      database
        .get<Tagging>('taggings')
        .query(notDeleted)
        .observe()
        .subscribe((list) => {
          next = { ...next, taggings: list };
          ready.taggings = true;
          emit();
        }),
    ];

    return () => {
      for (const sub of subs) sub.unsubscribe();
    };
  }, [database]);

  const results = useMemo(() => {
    if (slice === null || viewerId === undefined) return [];
    return matchSearch(buildRecords(slice, viewerId), query);
  }, [slice, viewerId, query]);

  const loading = slice === null || viewerId === undefined;

  return { results, loading };
}
