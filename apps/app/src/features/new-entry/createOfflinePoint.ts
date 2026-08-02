import type { Database } from '@nozbe/watermelondb';

import { createPointLocal } from '../../db';
import type Point from '../../db/models/Point';


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
  /** Defaults to the local owner placeholder until P1-B session lands. */
  ownerId?: string;
  usePlaceholderCoords?: boolean;
};

/**
 * Creates a standalone point in WatermelonDB only.
 * Sync is a later side effect — callers must not await the network.
 */
export async function createOfflinePoint(
  database: Database,
  input: CreateOfflinePointInput,
): Promise<Point> {
  const title = input.title.trim();
  const usePlaceholder = input.usePlaceholderCoords === true;
  const lat = usePlaceholder ? PLACEHOLDER_COORDS.lat : input.lat;
  const lon = usePlaceholder ? PLACEHOLDER_COORDS.lon : input.lon;

  return createPointLocal(database, {
    ownerId: input.ownerId ?? LOCAL_OWNER_PLACEHOLDER,
    title,
    lat,
    lon,
    positionSource: usePlaceholder
      ? POSITION_SOURCE_PLACEHOLDER
      : POSITION_SOURCE_MANUAL,
  });
}
