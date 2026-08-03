import { describe, expect, it } from 'vitest';

import {
  pullChangesToWatermelon,
  rawRowToWire,
  rejectedIdsFromPush,
  watermelonChangesToPush,
  wireRowToRaw,
} from './encode';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW_ISO = '2026-08-02T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

describe('wire ↔ WatermelonDB encode', () => {
  it('converts ISO dates and serialises geom for local apply', () => {
    const raw = wireRowToRaw({
      id: PLACE,
      owner_id: USER,
      title: 'A',
      visibility: 'private',
      created_at: NOW_ISO,
      updated_at: NOW_ISO,
      updated_by: USER,
      geom_geojson: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    });

    expect(raw.created_at).toBe(NOW_MS);
    expect(typeof raw.geom_geojson).toBe('string');
    expect(JSON.parse(String(raw.geom_geojson)).type).toBe('Polygon');
  });

  it('strips Watermelon meta and local_file_path on push encode', () => {
    const wire = rawRowToWire({
      id: PLACE,
      owner_id: USER,
      title: 'A',
      visibility: 'private',
      created_at: NOW_MS,
      updated_at: NOW_MS,
      updated_by: USER,
      _status: 'created',
      _changed: 'title',
      local_file_path: '/tmp/secret.jpg',
    });

    expect(wire._status).toBeUndefined();
    expect(wire.local_file_path).toBeUndefined();
    expect(wire.created_at).toBe(NOW_ISO);
  });

  it('maps pull bags to Watermelon change sets', () => {
    const wm = pullChangesToWatermelon({
      areas: { created: [], updated: [], deleted: [] },
      places: {
        created: [
          {
            id: PLACE,
            owner_id: USER,
            title: 'P',
            visibility: 'private',
            created_at: NOW_ISO,
            updated_at: NOW_ISO,
            updated_by: USER,
          },
        ],
        updated: [],
        deleted: [],
      },
      points: { created: [], updated: [], deleted: [] },
      collections: { created: [], updated: [], deleted: [] },
      collection_items: { created: [], updated: [], deleted: [] },
      tags: { created: [], updated: [], deleted: [] },
      taggings: { created: [], updated: [], deleted: [] },
      notes: { created: [], updated: [], deleted: [] },
      comments: { created: [], updated: [], deleted: [] },
      photos: { created: [], updated: [], deleted: [] },
      shares: { created: [], updated: [], deleted: [] },
    });

    expect(wm.places?.created).toHaveLength(1);
    expect(wm.places?.created[0]?.created_at).toBe(NOW_MS);
  });

  it('omits empty and non-synced tables from push payload', () => {
    const partial = watermelonChangesToPush({
      places: {
        created: [
          {
            id: PLACE,
            owner_id: USER,
            title: 'P',
            visibility: 'private',
            created_at: NOW_MS,
            updated_at: NOW_MS,
            updated_by: USER,
            _status: 'created',
            _changed: '',
          },
        ],
        updated: [],
        deleted: [],
      },
      users: {
        created: [{ id: USER, email: 'a@b.c', display_name: 'A', created_at: NOW_MS }],
        updated: [],
        deleted: [],
      },
    });

    expect(partial.places?.created).toHaveLength(1);
    expect(
      (partial as { users?: unknown }).users,
    ).toBeUndefined();
  });

  it('groups rejected ids by table for experimentalRejectedIds', () => {
    expect(
      rejectedIdsFromPush([
        { table: 'points', id: 'p1' },
        { table: 'points', id: 'p2' },
        { table: 'places', id: 'pl1' },
      ]),
    ).toEqual({
      points: ['p1', 'p2'],
      places: ['pl1'],
    });
  });
});
