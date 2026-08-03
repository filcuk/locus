import type { Database } from '@nozbe/watermelondb';

import { getSessionUser } from '../../auth';
import { createPointLocal } from '../../db';
import type Point from '../../db/models/Point';
import { requestSyncPush } from '../../sync/activeDriver';

import {
  LOCAL_OWNER_PLACEHOLDER,
  PLACEHOLDER_COORDS,
  POSITION_SOURCE_MANUAL,
  POSITION_SOURCE_PLACEHOLDER,
} from './constants';

export type CreateOfflinePointInput = {
  title: string;
  lat: number;
  lon: number;
  /** Defaults to the signed-in user; tests may inject explicitly. */
  ownerId?: string;
  usePlaceholderCoords?: boolean;
};

/**
 * Creates a standalone point in WatermelonDB only.
 * Sync is a fire-and-forget side effect — callers must not await the network.
 */
export async function createOfflinePoint(
  database: Database,
  input: CreateOfflinePointInput,
): Promise<Point> {
  const title = input.title.trim();
  const usePlaceholder = input.usePlaceholderCoords === true;
  const lat = usePlaceholder ? PLACEHOLDER_COORDS.lat : input.lat;
  const lon = usePlaceholder ? PLACEHOLDER_COORDS.lon : input.lon;
  const ownerId =
    input.ownerId ??
    (await getSessionUser())?.id ??
    LOCAL_OWNER_PLACEHOLDER;

  const point = await createPointLocal(database, {
    ownerId,
    title,
    lat,
    lon,
    positionSource: usePlaceholder
      ? POSITION_SOURCE_PLACEHOLDER
      : POSITION_SOURCE_MANUAL,
  });
  requestSyncPush();
  return point;
}
