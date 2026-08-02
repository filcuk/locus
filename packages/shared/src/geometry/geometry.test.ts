import { describe, expect, it } from 'vitest';

import type { AreaGeometry } from '../schemas/common.js';
import { bboxOf, distanceMeters, pointInPolygon, simplifyGeometry } from './index.js';

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

  it('returns distance in metres', () => {
    const metres = distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
    // ~111.3 km at the equator
    expect(metres).toBeGreaterThan(110_000);
    expect(metres).toBeLessThan(112_000);
  });
});
