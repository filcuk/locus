/**
 * Offline-capable local Point writes (DESIGN §3 flow 2 / §5).
 * Containment (place XOR area) is enforced before the WatermelonDB write.
 */
import { newEntityId, type Visibility } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';

import { assertPointContainment } from '../containment';
import Point from '../models/Point';

export type CreatePointLocalInput = {
  id?: string;
  ownerId: string;
  title: string;
  lat: number;
  lon: number;
  placeId?: string | null;
  areaId?: string | null;
  description?: string | null;
  elevationM?: number | null;
  positionSource?: string | null;
  featureKind?: string | null;
  recordedAt?: Date | null;
  visibility?: Visibility;
  updatedBy?: string;
};

export async function createPointLocal(
  database: Database,
  input: CreatePointLocalInput,
): Promise<Point> {
  assertPointContainment({
    placeId: input.placeId,
    areaId: input.areaId,
  });

  const id = input.id ?? newEntityId();
  const now = Date.now();
  const updatedBy = input.updatedBy ?? input.ownerId;

  return database.write(async () =>
    database.get<Point>('points').create((row) => {
      row._raw.id = id;
      row.ownerId = input.ownerId;
      row.placeId = input.placeId ?? null;
      row.areaId = input.areaId ?? null;
      row.title = input.title;
      row.description = input.description ?? null;
      row.lat = input.lat;
      row.lon = input.lon;
      row.elevationM = input.elevationM ?? null;
      row.positionSource = input.positionSource ?? null;
      row.featureKind = input.featureKind ?? null;
      row.recordedAt = input.recordedAt ?? null;
      row.visibility = input.visibility ?? 'private';
      row.updatedAt = new Date(now);
      row.updatedBy = updatedBy;
      row.deletedAt = null;
    }),
  );
}

export async function softDeletePointLocal(
  database: Database,
  point: Point,
): Promise<void> {
  await database.write(async () => {
    await point.update((row) => {
      row.deletedAt = new Date();
      row.updatedAt = new Date();
    });
  });
}
