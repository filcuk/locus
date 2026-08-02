/**
 * Point domain writes — always through syncApply so REST and push share ChangeLog (DESIGN §7).
 */
import { PointSchema, type Point } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { points } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { assertCan, type Principal } from './permissions.js';
import { DomainWriteError } from './domainWriteError.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export async function getPoint(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Point | null> {
  const [row] = await db
    .select()
    .from(points)
    .where(and(eq(points.id, id), isNull(points.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'point', id });
  return pointRowToWire(row);
}

export async function createPoint(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Point> {
  const parsed = PointSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runPointApply(handle, ctx, {
    points: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requirePoint(handle.db, parsed.data.id);
}

export async function updatePoint(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Point> {
  const parsed = PointSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runPointApply(handle, ctx, {
    points: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requirePoint(handle.db, id);
}

export async function deletePoint(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runPointApply(handle, ctx, {
    points: { created: [], updated: [], deleted: [id] },
  });
}

async function runPointApply(
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

async function requirePoint(db: DbHandle['db'], id: string): Promise<Point> {
  const [row] = await db.select().from(points).where(eq(points.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('point missing after successful apply');
  }
  return pointRowToWire(row);
}

function pointRowToWire(row: typeof points.$inferSelect): Point {
  return PointSchema.parse({
    id: row.id,
    owner_id: row.ownerId,
    place_id: row.placeId ?? undefined,
    area_id: row.areaId ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    lat: row.lat,
    lon: row.lon,
    elevation_m: row.elevationM ?? undefined,
    position_source: row.positionSource ?? undefined,
    feature_kind: row.featureKind ?? undefined,
    recorded_at: row.recordedAt ? toIsoDateTime(row.recordedAt) : undefined,
    visibility: row.visibility,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
