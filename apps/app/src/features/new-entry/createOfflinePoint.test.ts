import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { describe, expect, it, vi } from 'vitest';

import { modelClasses } from '../../db/models';
import { schema } from '../../db/schema';

import {
  LOCAL_OWNER_PLACEHOLDER,
  PLACEHOLDER_COORDS,
  POSITION_SOURCE_MANUAL,
  POSITION_SOURCE_PLACEHOLDER,
} from './constants';
import { createOfflinePoint } from './createOfflinePoint';
import { parseCoords } from './parseCoords';

const requestSyncPush = vi.fn();

vi.mock('../../sync/activeDriver', () => ({
  requestSyncPush: () => requestSyncPush(),
}));

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

describe('createOfflinePoint', () => {
  it('writes a standalone point with placeholder coords without a parent', async () => {
    requestSyncPush.mockClear();
    const db = memoryDatabase();
    const point = await createOfflinePoint(db, {
      title: '  Camp  ',
      lat: 99,
      lon: 99,
      usePlaceholderCoords: true,
    });

    expect(point.title).toBe('Camp');
    expect(point.ownerId).toBe(LOCAL_OWNER_PLACEHOLDER);
    expect(point.lat).toBe(PLACEHOLDER_COORDS.lat);
    expect(point.lon).toBe(PLACEHOLDER_COORDS.lon);
    expect(point.placeId).toBeNull();
    expect(point.areaId).toBeNull();
    expect(point.positionSource).toBe(POSITION_SOURCE_PLACEHOLDER);
    expect(requestSyncPush).toHaveBeenCalledOnce();

    const fetched = await db.get('points').find(point.id);
    expect(fetched).toBeTruthy();
  });

  it('writes manual lat/lon when placeholder mode is off', async () => {
    const db = memoryDatabase();
    const point = await createOfflinePoint(db, {
      title: 'Lookout',
      lat: 51.5,
      lon: -0.12,
      usePlaceholderCoords: false,
    });

    expect(point.lat).toBe(51.5);
    expect(point.lon).toBe(-0.12);
    expect(point.positionSource).toBe(POSITION_SOURCE_MANUAL);
  });
});

describe('parseCoords', () => {
  it('accepts in-range numbers and rejects garbage', () => {
    expect(parseCoords('51.5', '-0.1')).toEqual({
      ok: true,
      lat: 51.5,
      lon: -0.1,
    });
    expect(parseCoords('', '0').ok).toBe(false);
    expect(parseCoords('91', '0').ok).toBe(false);
    expect(parseCoords('0', '181').ok).toBe(false);
  });
});
