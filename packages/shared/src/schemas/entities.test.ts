import { describe, expect, it } from 'vitest';

import { newEntityId } from '../ids.js';
import { AreaGeometrySchema } from './common.js';
import { AreaSchema, NoteSchema, PointSchema } from './entities.js';

const now = '2026-08-02T12:00:00.000Z';
const owner = '018f0000-0000-7000-8000-000000000001';

describe('entity schemas (DESIGN §4)', () => {
  it('accepts a valid area with polygon geometry and derived bbox', () => {
    const parsed = AreaSchema.safeParse({
      id: newEntityId(),
      owner_id: owner,
      title: 'Ridge',
      geom_geojson: {
        type: 'Polygon',
        coordinates: [
          [
            [-1.1, 50.1],
            [-1.0, 50.1],
            [-1.0, 50.2],
            [-1.1, 50.2],
            [-1.1, 50.1],
          ],
        ],
      },
      bbox_min_lat: 50.1,
      bbox_min_lon: -1.1,
      bbox_max_lat: 50.2,
      bbox_max_lon: -1.0,
      visibility: 'private',
      created_at: now,
      updated_at: now,
      updated_by: owner,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an unclosed polygon ring', () => {
    const parsed = AreaGeometrySchema.safeParse({
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a point that sets both place_id and area_id', () => {
    const parsed = PointSchema.safeParse({
      id: newEntityId(),
      owner_id: owner,
      place_id: newEntityId(),
      area_id: newEntityId(),
      title: 'cairn',
      lat: 50.15,
      lon: -1.05,
      visibility: 'private',
      created_at: now,
      updated_at: now,
      updated_by: owner,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a standalone point with neither parent', () => {
    const parsed = PointSchema.safeParse({
      id: newEntityId(),
      owner_id: owner,
      title: 'cairn',
      lat: 50.15,
      lon: -1.05,
      visibility: 'unlisted',
      created_at: now,
      updated_at: now,
      updated_by: owner,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a note without body or visited_at', () => {
    const parsed = NoteSchema.safeParse({
      id: newEntityId(),
      author_id: owner,
      target_type: 'place',
      target_id: newEntityId(),
      created_at: now,
      updated_at: now,
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts a visit note with only visited_at', () => {
    const parsed = NoteSchema.safeParse({
      id: newEntityId(),
      author_id: owner,
      target_type: 'place',
      target_id: newEntityId(),
      visited_at: now,
      created_at: now,
      updated_at: now,
    });
    expect(parsed.success).toBe(true);
  });
});
