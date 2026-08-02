import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { describe, expect, it } from 'vitest';

import { modelClasses } from '../models';
import { schema } from '../schema';
import { createPlaceLocal } from './places';
import { createPointLocal } from './points';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function memoryDatabase(): Database {
  const adapter = new LokiJSAdapter({
    schema,
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
});
