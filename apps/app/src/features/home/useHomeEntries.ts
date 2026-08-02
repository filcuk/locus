import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/hooks';
import { useEffect, useMemo, useState } from 'react';

import type Area from '@/db/models/Area';
import type Place from '@/db/models/Place';
import type Point from '@/db/models/Point';

import { buildOrderedHierarchy } from './orderHierarchy';
import type { EntryRecord, HierarchyNode, LocationFix } from './types';

const notDeleted = Q.where('deleted_at', null);

/**
 * Observes areas/places/points from WatermelonDB and returns the ordered
 * Home hierarchy for the current one-shot fix.
 */
export function useHomeHierarchy(fix: LocationFix): {
  roots: HierarchyNode[];
  loading: boolean;
} {
  const database = useDatabase();
  const [records, setRecords] = useState<EntryRecord[] | null>(null);

  useEffect(() => {
    let areas: Area[] = [];
    let places: Place[] = [];
    let points: Point[] = [];
    let areasReady = false;
    let placesReady = false;
    let pointsReady = false;

    const emit = () => {
      if (!areasReady || !placesReady || !pointsReady) return;
      setRecords([
        ...areas.map(areaToRecord),
        ...places.map(placeToRecord),
        ...points.map(pointToRecord),
      ]);
    };

    const areasSub = database
      .get<Area>('areas')
      .query(notDeleted)
      .observe()
      .subscribe((rows) => {
        areas = rows;
        areasReady = true;
        emit();
      });
    const placesSub = database
      .get<Place>('places')
      .query(notDeleted)
      .observe()
      .subscribe((rows) => {
        places = rows;
        placesReady = true;
        emit();
      });
    const pointsSub = database
      .get<Point>('points')
      .query(notDeleted)
      .observe()
      .subscribe((rows) => {
        points = rows;
        pointsReady = true;
        emit();
      });

    return () => {
      areasSub.unsubscribe();
      placesSub.unsubscribe();
      pointsSub.unsubscribe();
    };
  }, [database]);

  const roots = useMemo(
    () => (records ? buildOrderedHierarchy(records, fix) : []),
    [records, fix],
  );

  return { roots, loading: records === null };
}

function areaToRecord(model: Area): EntryRecord {
  return {
    id: model.id,
    kind: 'area',
    title: model.title,
    updatedAt: model.updatedAt.getTime(),
    lat: null,
    lon: null,
    areaId: null,
    placeId: null,
    geomGeojson: model.geomGeojson,
  };
}

function placeToRecord(model: Place): EntryRecord {
  return {
    id: model.id,
    kind: 'place',
    title: model.title,
    updatedAt: model.updatedAt.getTime(),
    lat: model.lat,
    lon: model.lon,
    areaId: model.areaId,
    placeId: null,
    geomGeojson: null,
  };
}

function pointToRecord(model: Point): EntryRecord {
  return {
    id: model.id,
    kind: 'point',
    title: model.title,
    updatedAt: model.updatedAt.getTime(),
    lat: model.lat,
    lon: model.lon,
    areaId: model.areaId,
    placeId: model.placeId,
    geomGeojson: null,
  };
}
