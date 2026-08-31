import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { describe, expect, it } from 'vitest';
import type { AreaGeometry } from '@locus/shared';

import { modelClasses } from '../models';
import { migrations } from '../migrations';
import { schema } from '../schema';
import { createAreaLocal, softDeleteAreaLocal } from './areas';
import {
  createCollectionItemLocal,
  createCollectionLocal,
  softDeleteCollectionLocal,
} from './collections';
import { createPlaceLocal } from './places';
import { createPointLocal } from './points';

const SQUARE = {
  type: 'Polygon' as const,
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
const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function memoryDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: false,
  });
  return new Database({
    adapter,
    modelClasses: modelClasses as ConstructorParameters<typeof Database>[0]['modelClasses'],
  });
}

describe('offline place/point writers (WatermelonDB)', () => {
  it('creates a place locally without network', async () => {
    const db = memoryDatabase();
    const place = await createPlaceLocal(db, {
      ownerId: OWNER,
      title: 'Offline place',
      lat: 51.5,
      lon: -0.1,
    });
    expect(place.title).toBe('Offline place');
    expect(place.ownerId).toBe(OWNER);
    expect(place.id.length).toBeGreaterThan(0);

    const fetched = await db.get('places').find(place.id);
    expect(fetched).toBeTruthy();
  });

  it('creates a point under a place and rejects dual parents', async () => {
    const db = memoryDatabase();
    const place = await createPlaceLocal(db, {
      ownerId: OWNER,
      title: 'Parent',
    });

    const point = await createPointLocal(db, {
      ownerId: OWNER,
      title: 'Offline point',
      lat: 51.5,
      lon: -0.12,
      placeId: place.id,
      positionSource: 'gps',
    });
    expect(point.placeId).toBe(place.id);
    expect(point.areaId).toBeNull();

    await expect(
      createPointLocal(db, {
        ownerId: OWNER,
        title: 'Bad',
        lat: 1,
        lon: 2,
        placeId: place.id,
        areaId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      }),
    ).rejects.toThrow(/never both/);
  });

  it('creates an area with derived bbox and cascades soft-delete', async () => {
    const db = memoryDatabase();
    const area = await createAreaLocal(db, {
      ownerId: OWNER,
      title: 'Offline area',
      geom: SQUARE,
    });
    expect(area.title).toBe('Offline area');
    expect(area.bboxMinLat).toBe(0);
    expect(area.bboxMaxLon).toBe(1);
    expect(typeof area.geomGeojson).toBe('string');

    const place = await createPlaceLocal(db, {
      ownerId: OWNER,
      title: 'In area',
      areaId: area.id,
    });
    expect(place.areaId).toBe(area.id);

    const nested = await createPointLocal(db, {
      ownerId: OWNER,
      title: 'Under place',
      lat: 0.5,
      lon: 0.5,
      placeId: place.id,
    });
    const direct = await createPointLocal(db, {
      ownerId: OWNER,
      title: 'Direct in area',
      lat: 0.2,
      lon: 0.2,
      areaId: area.id,
    });
    expect(direct.areaId).toBe(area.id);

    await softDeleteAreaLocal(db, area);

    const areaAfter = await db.get('areas').find(area.id);
    expect((areaAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
    const placeAfter = await db.get('places').find(place.id);
    expect((placeAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
    const nestedAfter = await db.get('points').find(nested.id);
    expect((nestedAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
    const directAfter = await db.get('points').find(direct.id);
    expect((directAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
  });

  it('rejects invalid area geometry before writing locally', async () => {
    const db = memoryDatabase();
    const invalidGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ],
    } as unknown as AreaGeometry;

    await expect(
      createAreaLocal(db, {
        ownerId: OWNER,
        title: 'Invalid area',
        geom: invalidGeometry,
      }),
    ).rejects.toThrow(/unique vertices/);
  });

  it('creates a collection with members and cascades soft-delete', async () => {
    const db = memoryDatabase();
    const collection = await createCollectionLocal(db, {
      ownerId: OWNER,
      title: 'Offline collection',
    });
    expect(collection.title).toBe('Offline collection');

    const point = await createPointLocal(db, {
      ownerId: OWNER,
      title: 'Member',
      lat: 1,
      lon: 2,
    });
    const item = await createCollectionItemLocal(db, {
      collectionId: collection.id,
      itemType: 'point',
      itemId: point.id,
    });
    expect(item.collectionId).toBe(collection.id);

    await softDeleteCollectionLocal(db, collection);

    const collAfter = await db.get('collections').find(collection.id);
    expect((collAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
    const itemAfter = await db.get('collection_items').find(item.id);
    expect((itemAfter as { deletedAt: Date | null }).deletedAt).toBeTruthy();
    const pointAfter = await db.get('points').find(point.id);
    expect((pointAfter as { deletedAt: Date | null }).deletedAt).toBeNull();
  });
});
