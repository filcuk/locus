/**
 * Offline-capable local Area writes (DESIGN §3 flow 3 / §5).
 * Network sync is a side effect owned by the sync driver — not this module.
 * Bbox is derived from geom_geojson on write (DESIGN §4).
 */
import {
  AreaGeometrySchema,
  bboxOf,
  newEntityId,
  prepareAreaGeometry,
  type AreaGeometry,
  type Visibility,
} from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';

import { serializeGeomGeojson } from '../containment';
import Area from '../models/Area';
import Place from '../models/Place';
import Point from '../models/Point';

export type CreateAreaLocalInput = {
  id?: string;
  ownerId: string;
  title: string;
  geom: AreaGeometry;
  description?: string | null;
  visibility?: Visibility;
  updatedBy?: string;
};

export async function createAreaLocal(
  database: Database,
  input: CreateAreaLocalInput,
): Promise<Area> {
  const id = input.id ?? newEntityId();
  const now = Date.now();
  const updatedBy = input.updatedBy ?? input.ownerId;
  const geometry = AreaGeometrySchema.parse(input.geom);
  const prepared = prepareAreaGeometry(geometry);
  if (!prepared.ok) {
    throw new Error(prepared.message);
  }
  const bbox = bboxOf(prepared.geometry);

  return database.write(async () =>
    database.get<Area>('areas').create((row) => {
      row._raw.id = id;
      row.ownerId = input.ownerId;
      row.title = input.title;
      row.description = input.description ?? null;
      row.geomGeojson = serializeGeomGeojson(prepared.geometry);
      row.bboxMinLat = bbox.bbox_min_lat;
      row.bboxMinLon = bbox.bbox_min_lon;
      row.bboxMaxLat = bbox.bbox_max_lat;
      row.bboxMaxLon = bbox.bbox_max_lon;
      row.visibility = input.visibility ?? 'private';
      row.updatedAt = new Date(now);
      row.updatedBy = updatedBy;
      row.deletedAt = null;
    }),
  );
}

/**
 * Soft-delete an area and cascade owned places / points locally
 * (DESIGN §4 — mirrors server cascade; sync will push the parent delete).
 */
export async function softDeleteAreaLocal(
  database: Database,
  area: Area,
): Promise<void> {
  const now = new Date();
  await database.write(async () => {
    // Filter in memory: LokiJS optional-column equality can miss parent ids.
    const places = (await database.get<Place>('places').query().fetch()).filter(
      (place) =>
        place.areaId === area.id &&
        place.ownerId === area.ownerId &&
        place.deletedAt == null,
    );

    for (const place of places) {
      const nestedPoints = (await database.get<Point>('points').query().fetch()).filter(
        (point) =>
          point.placeId === place.id &&
          point.ownerId === place.ownerId &&
          point.deletedAt == null,
      );
      for (const point of nestedPoints) {
        await point.update((row) => {
          row.deletedAt = now;
          row.updatedAt = now;
        });
      }
      await place.update((row) => {
        row.deletedAt = now;
        row.updatedAt = now;
      });
    }

    const directPoints = (await database.get<Point>('points').query().fetch()).filter(
      (point) =>
        point.areaId === area.id &&
        point.ownerId === area.ownerId &&
        point.deletedAt == null,
    );
    for (const point of directPoints) {
      await point.update((row) => {
        row.deletedAt = now;
        row.updatedAt = now;
      });
    }

    await area.update((row) => {
      row.deletedAt = now;
      row.updatedAt = now;
    });
  });
}
