import { describe, expect, it } from 'vitest';

import {
  assertPointContainment,
  isValidPointContainment,
  parseGeomGeojson,
  serializeGeomGeojson,
} from './containment';
import { schema } from './schema';

const ALLOWED_COLUMN_TYPES = new Set(['string', 'number', 'boolean']);

function tables() {
  return Object.values(schema.tables);
}

function tableNamed(name: string) {
  return schema.tables[name];
}

describe('WatermelonDB schema-shape spike (DESIGN §11 / §4)', () => {
  it('maps every column to string, number, or boolean only', () => {
    for (const table of tables()) {
      for (const column of Object.values(table.columns)) {
        expect(
          ALLOWED_COLUMN_TYPES.has(column.type),
          `${table.name}.${column.name} has unsupported type ${column.type}`,
        ).toBe(true);
      }
    }
  });

  it('stores geom_geojson as a string column on areas', () => {
    const areas = tableNamed('areas');
    expect(areas).toBeDefined();
    const geom = areas?.columns['geom_geojson'];
    expect(geom?.type).toBe('string');
  });

  it('stores created_at / updated_at as required numbers (WatermelonDB reserved)', () => {
    for (const table of tables()) {
      const created = table.columns['created_at'];
      const updated = table.columns['updated_at'];
      if (created) {
        expect(created.type).toBe('number');
        expect(created.isOptional).toBeFalsy();
      }
      if (updated) {
        expect(updated.type).toBe('number');
        expect(updated.isOptional).toBeFalsy();
      }
    }
  });

  it('round-trips geom_geojson through serialise/parse', () => {
    const geometry = {
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
    const raw = serializeGeomGeojson(geometry);
    expect(typeof raw).toBe('string');
    expect(parseGeomGeojson(raw)).toEqual(geometry);
  });

  it('enforces point containment in application code (no DB FK/CHECK)', () => {
    expect(isValidPointContainment({ placeId: 'p1', areaId: null })).toBe(true);
    expect(isValidPointContainment({ placeId: null, areaId: 'a1' })).toBe(true);
    expect(isValidPointContainment({ placeId: null, areaId: null })).toBe(true);
    expect(isValidPointContainment({ placeId: 'p1', areaId: 'a1' })).toBe(false);
    expect(() =>
      assertPointContainment({ placeId: 'p1', areaId: 'a1' }),
    ).toThrow(/never both/);
  });

  it('declares logical parent id columns without relying on foreign keys', () => {
    const points = tableNamed('points');
    const places = tableNamed('places');
    expect(points?.columns['place_id']).toBeDefined();
    expect(points?.columns['area_id']).toBeDefined();
    expect(places?.columns['area_id']).toBeDefined();
    // WatermelonDB TableSchema has no FK metadata — absence is the point of the spike.
    for (const table of tables()) {
      expect('foreignKeys' in table).toBe(false);
    }
  });
});
