import { describe, expect, it } from 'vitest';

import { buildOrderedHierarchy } from './orderHierarchy';
import type { EntryRecord } from './types';

const FIX = { lat: 51.5, lon: -0.12 };

function place(
  id: string,
  title: string,
  lat: number,
  lon: number,
  opts: { areaId?: string; updatedAt?: number } = {},
): EntryRecord {
  return {
    id,
    kind: 'place',
    title,
    updatedAt: opts.updatedAt ?? 1,
    lat,
    lon,
    areaId: opts.areaId ?? null,
    placeId: null,
    geomGeojson: null,
  };
}

function point(
  id: string,
  title: string,
  lat: number,
  lon: number,
  opts: { placeId?: string; areaId?: string; updatedAt?: number } = {},
): EntryRecord {
  return {
    id,
    kind: 'point',
    title,
    updatedAt: opts.updatedAt ?? 1,
    lat,
    lon,
    areaId: opts.areaId ?? null,
    placeId: opts.placeId ?? null,
    geomGeojson: null,
  };
}

function area(
  id: string,
  title: string,
  geomGeojson: string,
  updatedAt = 1,
): EntryRecord {
  return {
    id,
    kind: 'area',
    title,
    updatedAt,
    lat: null,
    lon: null,
    areaId: null,
    placeId: null,
    geomGeojson,
  };
}

/** ~1° square around the fix — contains FIX. */
const aroundFix = JSON.stringify({
  type: 'Polygon',
  coordinates: [
    [
      [-0.13, 51.49],
      [-0.11, 51.49],
      [-0.11, 51.51],
      [-0.13, 51.51],
      [-0.13, 51.49],
    ],
  ],
});

describe('buildOrderedHierarchy (DESIGN §8 Home)', () => {
  it('keeps place→point hierarchy (no orphaned children)', () => {
    const tree = buildOrderedHierarchy(
      [
        place('p1', 'Cafe', 51.5, -0.12),
        point('pt1', 'Table', 51.5001, -0.1201, { placeId: 'p1' }),
        place('p2', 'Park', 52, 0),
      ],
      FIX,
    );

    expect(tree.map((n) => n.record.id)).toEqual(['p1', 'p2']);
    expect(tree[0]!.children).toHaveLength(1);
    expect(tree[0]!.children[0]!.record.id).toBe('pt1');
  });

  it('sorts roots by distance; children by the same rule within a parent', () => {
    const tree = buildOrderedHierarchy(
      [
        place('far', 'Far place', 52.5, 0),
        place('near', 'Near place', 51.501, -0.12),
        point('far-pt', 'Far child', 53, 0, { placeId: 'near' }),
        point('near-pt', 'Near child', 51.5005, -0.12, { placeId: 'near' }),
      ],
      FIX,
    );

    expect(tree.map((n) => n.record.id)).toEqual(['near', 'far']);
    expect(tree[0]!.children.map((n) => n.record.id)).toEqual([
      'near-pt',
      'far-pt',
    ]);
  });

  it('uses shared distanceMetres so nearer roots win', () => {
    const tree = buildOrderedHierarchy(
      [
        place('a', 'A', 51.51, -0.12),
        place('b', 'B', 51.505, -0.12),
      ],
      FIX,
    );
    expect(tree[0]!.record.id).toBe('b');
    expect(tree[0]!.distanceMeters).toBeLessThan(tree[1]!.distanceMeters!);
  });

  it('falls back to updated_at when there is no location fix', () => {
    const tree = buildOrderedHierarchy(
      [
        place('old', 'Old', 51.5, -0.12, { updatedAt: 100 }),
        place('new', 'New', 60, 0, { updatedAt: 200 }),
      ],
      null,
    );
    expect(tree.map((n) => n.record.id)).toEqual(['new', 'old']);
    expect(tree.every((n) => n.distanceMeters === null)).toBe(true);
  });

  it('mixes area children: places and direct points at the same level', () => {
    const tree = buildOrderedHierarchy(
      [
        area('a1', 'Neighbourhood', aroundFix),
        place('pl', 'Shop', 51.5002, -0.1202, { areaId: 'a1' }),
        point('direct', 'Bench', 51.5003, -0.1203, { areaId: 'a1' }),
        point('nested', 'Inside shop', 51.5002, -0.1202, { placeId: 'pl' }),
      ],
      FIX,
    );

    expect(tree).toHaveLength(1);
    expect(tree[0]!.youAreHere).toBe(true);
    expect(tree[0]!.distanceMeters).toBe(0);
    const childIds = tree[0]!.children.map((n) => n.record.id).sort();
    expect(childIds).toEqual(['direct', 'pl']);
    expect(tree[0]!.children.find((n) => n.record.id === 'pl')!.children[0]!.record.id).toBe(
      'nested',
    );
  });

  it('parent distance is the min of own and descendants', () => {
    // Area outside the fix (far polygon) but with a near child place.
    const farPoly = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [10, 10],
          [11, 10],
          [11, 11],
          [10, 11],
          [10, 10],
        ],
      ],
    });
    const tree = buildOrderedHierarchy(
      [
        area('far-area', 'Far area', farPoly),
        place('near-in-far', 'Near child', 51.5, -0.12, { areaId: 'far-area' }),
        place('also-root', 'Other root', 52, 0),
      ],
      FIX,
    );

    expect(tree[0]!.record.id).toBe('far-area');
    expect(tree[0]!.distanceMeters).toBeLessThan(1_000);
    expect(tree[0]!.youAreHere).toBe(false);
  });
});
