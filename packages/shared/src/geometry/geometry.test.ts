import { describe, expect, it } from 'vitest';

import type { AreaGeometry } from '../schemas/common.js';
import {
  bboxOf,
  countRingVertices,
  DEFAULT_POLYGON_MAX_VERTICES_PER_RING,
  DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG,
  distanceMeters,
  maxRingVertexCount,
  pointInPolygon,
  prepareAreaGeometry,
  simplifyGeometry,
} from './index.js';

const square: AreaGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

/** Closed ring with `unique` vertices spaced so default simplify will not collapse them. */
function denseCircle(unique: number): AreaGeometry {
  const ring: [number, number][] = [];
  for (let i = 0; i < unique; i++) {
    const a = (2 * Math.PI * i) / unique;
    ring.push([Math.cos(a), Math.sin(a)]);
  }
  const first = ring[0]!;
  ring.push([first[0], first[1]]);
  return { type: 'Polygon', coordinates: [ring] };
}

describe('geometry helpers (DESIGN §4 / §6)', () => {
  it('derives bbox columns from polygon rings', () => {
    expect(bboxOf(square)).toEqual({
      bbox_min_lon: 0,
      bbox_min_lat: 0,
      bbox_max_lon: 1,
      bbox_max_lat: 1,
    });
  });

  it('tests point-in-polygon without implying membership', () => {
    expect(pointInPolygon({ lat: 0.5, lon: 0.5 }, square)).toBe(true);
    expect(pointInPolygon({ lat: 2, lon: 2 }, square)).toBe(false);
  });

  it('simplifies geometry and preserves polygon type', () => {
    const dense: AreaGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.000001, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const simplified = simplifyGeometry(dense, 0.01);
    expect(simplified.type).toBe('Polygon');
    expect(simplified.coordinates[0]!.length).toBeLessThan(dense.coordinates[0]!.length);
  });

  it('defaults simplify tolerance to the settled DESIGN value', () => {
    expect(DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG).toBe(0.00005);
    expect(DEFAULT_POLYGON_MAX_VERTICES_PER_RING).toBe(128);
  });

  it('counts unique ring vertices excluding the closing duplicate', () => {
    expect(countRingVertices(square.coordinates[0]!)).toBe(4);
    expect(maxRingVertexCount(square)).toBe(4);
  });

  it('prepareAreaGeometry simplifies and accepts rings within the cap', () => {
    const dense: AreaGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0.000001, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const prepared = prepareAreaGeometry(dense, {
      maxVerticesPerRing: 128,
      simplifyToleranceDeg: 0.01,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.geometry.type).toBe('Polygon');
    expect(maxRingVertexCount(prepared.geometry)).toBeLessThanOrEqual(128);
  });

  it('prepareAreaGeometry rejects rings still over the vertex cap after simplify', () => {
    const over = denseCircle(200);
    const prepared = prepareAreaGeometry(over, {
      maxVerticesPerRing: 128,
      simplifyToleranceDeg: DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG,
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.code).toBe('TOO_MANY_VERTICES');
    expect(prepared.ringVertexCount).toBeGreaterThan(128);
  });

  it('returns distance in metres', () => {
    const metres = distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    // ~111.3 km at the equator
    expect(metres).toBeGreaterThan(110_000);
    expect(metres).toBeLessThan(112_000);
  });
});
