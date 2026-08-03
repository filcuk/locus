/**
 * Area domain writes — always through syncApply so REST and push share ChangeLog (DESIGN §7).
 */
import { AreaSchema, type Area } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { areas } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getArea(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Area | null> {
  const [row] = await db
    .select()
    .from(areas)
    .where(and(eq(areas.id, id), isNull(areas.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'area', id });
  return areaRowToWire(row);
}

export async function createArea(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Area> {
  const parsed = AreaSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runAreaApply(handle, ctx, {
    areas: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireArea(handle.db, parsed.data.id);
}

export async function updateArea(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Area> {
  const parsed = AreaSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runAreaApply(handle, ctx, {
    areas: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requireArea(handle.db, id);
}

export async function deleteArea(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runAreaApply(handle, ctx, {
    areas: { created: [], updated: [], deleted: [id] },
  });
}

async function runAreaApply(
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

async function requireArea(db: DbHandle['db'], id: string): Promise<Area> {
  const [row] = await db.select().from(areas).where(eq(areas.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('area missing after successful apply');
  }
  return areaRowToWire(row);
}

function areaRowToWire(row: typeof areas.$inferSelect): Area {
  return AreaSchema.parse({
    id: row.id,
    owner_id: row.ownerId,
    title: row.title,
    description: row.description ?? undefined,
    geom_geojson: row.geomGeojson,
    bbox_min_lat: row.bboxMinLat,
    bbox_min_lon: row.bboxMinLon,
    bbox_max_lat: row.bboxMaxLat,
    bbox_max_lon: row.bboxMaxLon,
    visibility: row.visibility,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
