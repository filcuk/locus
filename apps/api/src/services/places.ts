/**
 * Place domain writes — always through syncApply so REST and push share ChangeLog (DESIGN §7).
 */
import { PlaceSchema, type Place } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { places } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getPlace(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Place | null> {
  const [row] = await db
    .select()
    .from(places)
    .where(and(eq(places.id, id), isNull(places.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'place', id });
  return placeRowToWire(row);
}

export async function createPlace(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Place> {
  const parsed = PlaceSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runPlaceApply(handle, ctx, {
    places: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requirePlace(handle.db, parsed.data.id);
}

export async function updatePlace(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Place> {
  const parsed = PlaceSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runPlaceApply(handle, ctx, {
    places: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requirePlace(handle.db, id);
}

export async function deletePlace(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runPlaceApply(handle, ctx, {
    places: { created: [], updated: [], deleted: [id] },
  });
}

async function runPlaceApply(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  changes: Parameters<typeof syncApply>[1],
): Promise<void> {
  await withChangeLogWriter(handle, async () => {
    const result = await syncApply({ ...ctx, db: handle.db }, changes);
    const rejection = result.rejected[0];
    if (rejection) {
      throw new DomainWriteError(
        rejection.code === 'FORBIDDEN' ? 403 : 422,
        rejection.code,
        rejection.message,
      );
    }
  });
}

async function requirePlace(db: DbHandle['db'], id: string): Promise<Place> {
  const [row] = await db.select().from(places).where(eq(places.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('place missing after successful apply');
  }
  return placeRowToWire(row);
}

function placeRowToWire(row: typeof places.$inferSelect): Place {
  return PlaceSchema.parse({
    id: row.id,
    owner_id: row.ownerId,
    area_id: row.areaId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    lat: row.lat ?? undefined,
    lon: row.lon ?? undefined,
    elevation_m: row.elevationM ?? undefined,
    position_source: row.positionSource ?? undefined,
    visibility: row.visibility,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
