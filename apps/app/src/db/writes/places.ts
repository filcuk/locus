/**
 * Offline-capable local Place writes (DESIGN §3 flow 2 / §5).
 * Network sync is a side effect owned by the sync driver — not this module.
 */
import { newEntityId, type Visibility } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import Place from '../models/Place';
import Point from '../models/Point';

export type CreatePlaceLocalInput = {
  id?: string;
  ownerId: string;
  title: string;
  description?: string | null;
  areaId?: string | null;
  lat?: number | null;
  lon?: number | null;
  elevationM?: number | null;
  positionSource?: string | null;
  visibility?: Visibility;
  updatedBy?: string;
};

export async function createPlaceLocal(
  database: Database,
  input: CreatePlaceLocalInput,
): Promise<Place> {
  const id = input.id ?? newEntityId();
  const now = Date.now();
  const updatedBy = input.updatedBy ?? input.ownerId;

  return database.write(async () =>
    database.get<Place>('places').create((row) => {
      row._raw.id = id;
      row.ownerId = input.ownerId;
      row.areaId = input.areaId ?? null;
      row.title = input.title;
      row.description = input.description ?? null;
      row.lat = input.lat ?? null;
      row.lon = input.lon ?? null;
      row.elevationM = input.elevationM ?? null;
      row.positionSource = input.positionSource ?? null;
      row.visibility = input.visibility ?? 'private';
      row.updatedAt = new Date(now);
      row.updatedBy = updatedBy;
      row.deletedAt = null;
    }),
  );
}

/**
 * Soft-delete a place and cascade owned points locally (DESIGN §4).
 */
export async function softDeletePlaceLocal(
  database: Database,
  place: Place,
): Promise<void> {
  const now = new Date();
  await database.write(async () => {
    const ownedPoints = await database
      .get<Point>('points')
      .query(Q.where('place_id', place.id), Q.where('owner_id', place.ownerId))
      .fetch();
    for (const point of ownedPoints) {
      if (point.deletedAt != null) continue;
      await point.update((row) => {
        row.deletedAt = now;
        row.updatedAt = now;
      });
    }
    await place.update((row) => {
      row.deletedAt = now;
      row.updatedAt = now;
    });
  });
}
