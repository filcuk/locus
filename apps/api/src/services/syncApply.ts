/**
 * Shared write path for REST domain writes and /sync/push (DESIGN §5 / §7).
 * Every successful apply emits exactly one ChangeLog row (cascade soft-deletes
 * of owned children ride on that single parent delete event — DESIGN §4).
 */
import {
  PlaceSchema,
  PointSchema,
  AreaSchema,
  ShareSchema,
  bboxOf,
  type AreaGeometry,
  type CascadeSoftDeletePayload,
  type SyncedTable,
} from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { areas, places, points, shares } from '../db/schema.js';
import { appendChange, type ChangeOp } from './changeLog.js';
import { assertCan, ForbiddenError, type Principal } from './permissions.js';

export type ApplyContext = {
  db: DbHandle['db'];
  principal: Principal & { kind: 'user' };
  deviceId: string;
};

export type ApplyRejection = {
  table: SyncedTable;
  id: string;
  code: 'FORBIDDEN' | 'VALIDATION_FAILED';
  message: string;
};

export type ApplyResult = {
  applied: number;
  rejected: ApplyRejection[];
};

type TableChanges = {
  created?: unknown[];
  updated?: unknown[];
  deleted?: string[];
};

export async function syncApply(
  ctx: ApplyContext,
  changes: Partial<Record<SyncedTable, TableChanges>>,
): Promise<ApplyResult> {
  let applied = 0;
  const rejected: ApplyRejection[] = [];

  for (const [table, bag] of Object.entries(changes) as Array<
    [SyncedTable, TableChanges | undefined]
  >) {
    if (!bag) continue;
    for (const row of bag.created ?? []) {
      const outcome = await applyOne(ctx, table, 'create', row);
      if (outcome === 'ok') applied += 1;
      else rejected.push(outcome);
    }
    for (const row of bag.updated ?? []) {
      const outcome = await applyOne(ctx, table, 'update', row);
      if (outcome === 'ok') applied += 1;
      else rejected.push(outcome);
    }
    for (const id of bag.deleted ?? []) {
      const outcome = await applyDelete(ctx, table, id);
      if (outcome === 'ok') applied += 1;
      else rejected.push(outcome);
    }
  }

  return { applied, rejected };
}

async function applyOne(
  ctx: ApplyContext,
  table: SyncedTable,
  op: 'create' | 'update',
  raw: unknown,
): Promise<'ok' | ApplyRejection> {
  try {
    switch (table) {
      case 'places':
        return await applyPlace(ctx, op, raw);
      case 'points':
        return await applyPoint(ctx, op, raw);
      case 'areas':
        return await applyArea(ctx, op, raw);
      case 'shares':
        return await applyShare(ctx, op, raw);
      default:
        return {
          table,
          id: readId(raw),
          code: 'VALIDATION_FAILED',
          message: `table ${table} not implemented on push yet`,
        };
    }
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return { table, id: readId(raw), code: 'FORBIDDEN', message: 'Forbidden' };
    }
    throw err;
  }
}

async function applyDelete(
  ctx: ApplyContext,
  table: SyncedTable,
  id: string,
): Promise<'ok' | ApplyRejection> {
  const resourceType = tableToResource(table);
  if (resourceType) {
    try {
      await assertCan(ctx.db, ctx.principal, 'delete', { type: resourceType, id });
    } catch {
      return { table, id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
  }

  const now = new Date().toISOString();
  let cascadePayload: CascadeSoftDeletePayload | null = null;

  switch (table) {
    case 'places': {
      const cascaded = await cascadeSoftDeleteOwnedPlaceChildren(ctx.db, id, now);
      await ctx.db
        .update(places)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(places.id, id));
      cascadePayload = { cascaded: { places: [], points: cascaded.points } };
      break;
    }
    case 'points':
      await ctx.db.update(points).set({ deletedAt: now, updatedAt: now }).where(eq(points.id, id));
      break;
    case 'areas': {
      const cascaded = await cascadeSoftDeleteOwnedAreaChildren(ctx.db, id, now);
      await ctx.db.update(areas).set({ deletedAt: now, updatedAt: now }).where(eq(areas.id, id));
      cascadePayload = { cascaded };
      break;
    }
    case 'shares':
      await ctx.db.delete(shares).where(eq(shares.id, id));
      break;
    default:
      return {
        table,
        id,
        code: 'VALIDATION_FAILED',
        message: `table ${table} not implemented on push yet`,
      };
  }

  const hasCascade =
    cascadePayload !== null &&
    (cascadePayload.cascaded.places.length > 0 || cascadePayload.cascaded.points.length > 0);

  await appendChange(ctx.db, {
    entityType: table,
    entityId: id,
    op: 'delete',
    payload: hasCascade ? cascadePayload : null,
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

/**
 * Soft-delete owned places under an area, and owned points under those places
 * plus direct owned points on the area (DESIGN §4 cascade).
 */
async function cascadeSoftDeleteOwnedAreaChildren(
  db: ApplyContext['db'],
  areaId: string,
  now: string,
): Promise<{ places: string[]; points: string[] }> {
  const [area] = await db.select().from(areas).where(eq(areas.id, areaId)).limit(1);
  if (!area) return { places: [], points: [] };

  const ownedPlaces = await db
    .select({ id: places.id })
    .from(places)
    .where(
      and(eq(places.areaId, areaId), eq(places.ownerId, area.ownerId), isNull(places.deletedAt)),
    );

  const placeIds: string[] = [];
  const pointIds: string[] = [];

  for (const place of ownedPlaces) {
    placeIds.push(place.id);
    const nested = await cascadeSoftDeleteOwnedPlaceChildren(db, place.id, now);
    pointIds.push(...nested.points);
    await db
      .update(places)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(places.id, place.id));
  }

  const directPoints = await db
    .select({ id: points.id })
    .from(points)
    .where(
      and(eq(points.areaId, areaId), eq(points.ownerId, area.ownerId), isNull(points.deletedAt)),
    );

  for (const point of directPoints) {
    pointIds.push(point.id);
    await db
      .update(points)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(points.id, point.id));
  }

  return { places: placeIds, points: pointIds };
}

/** Soft-delete owned points under a place (DESIGN §4 cascade). */
async function cascadeSoftDeleteOwnedPlaceChildren(
  db: ApplyContext['db'],
  placeId: string,
  now: string,
): Promise<{ points: string[] }> {
  const [place] = await db.select().from(places).where(eq(places.id, placeId)).limit(1);
  if (!place) return { points: [] };

  const ownedPoints = await db
    .select({ id: points.id })
    .from(points)
    .where(
      and(eq(points.placeId, placeId), eq(points.ownerId, place.ownerId), isNull(points.deletedAt)),
    );

  const pointIds: string[] = [];
  for (const point of ownedPoints) {
    pointIds.push(point.id);
    await db
      .update(points)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(points.id, point.id));
  }
  return { points: pointIds };
}

async function applyPlace(
  ctx: ApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | ApplyRejection> {
  const parsed = PlaceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'places',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  if (op === 'create') {
    // Creating a child under a parent needs create_child on parent when set;
    // standalone places are owned by the actor.
    if (row.area_id) {
      await assertCan(ctx.db, ctx.principal, 'create_child', {
        type: 'area',
        id: row.area_id,
      });
    }
  } else {
    await assertCan(ctx.db, ctx.principal, 'edit', { type: 'place', id: row.id });
  }

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    ownerId: op === 'create' ? ctx.principal.userId : row.owner_id,
    areaId: row.area_id ?? null,
    title: row.title,
    description: row.description ?? null,
    lat: row.lat ?? null,
    lon: row.lon ?? null,
    elevationM: row.elevation_m ?? null,
    positionSource: row.position_source ?? null,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: now,
    updatedBy: ctx.principal.userId,
    deletedAt: row.deleted_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(places).values(values);
    } else {
      await ctx.db.update(places).set(values).where(eq(places.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'places',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'place write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'places',
    entityId: row.id,
    op,
    payload: placeToWire({ ...values, ownerId: values.ownerId }),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

async function applyPoint(
  ctx: ApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | ApplyRejection> {
  const parsed = PointSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'points',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  if (op === 'create') {
    if (row.place_id) {
      await assertCan(ctx.db, ctx.principal, 'create_child', {
        type: 'place',
        id: row.place_id,
      });
    } else if (row.area_id) {
      await assertCan(ctx.db, ctx.principal, 'create_child', {
        type: 'area',
        id: row.area_id,
      });
    }
  } else {
    await assertCan(ctx.db, ctx.principal, 'edit', { type: 'point', id: row.id });
  }

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    ownerId: op === 'create' ? ctx.principal.userId : row.owner_id,
    placeId: row.place_id ?? null,
    areaId: row.area_id ?? null,
    title: row.title,
    description: row.description ?? null,
    lat: row.lat,
    lon: row.lon,
    elevationM: row.elevation_m ?? null,
    positionSource: row.position_source ?? null,
    featureKind: row.feature_kind ?? null,
    recordedAt: row.recorded_at ?? null,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: now,
    updatedBy: ctx.principal.userId,
    deletedAt: row.deleted_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(points).values(values);
    } else {
      await ctx.db.update(points).set(values).where(eq(points.id, row.id));
    }
  } catch (err) {
    // DESIGN §4 CHECK: place_id XOR area_id (and other integrity constraints).
    if (isPgConstraintError(err)) {
      return {
        table: 'points',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'A point may belong to a place or an area, never both',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'points',
    entityId: row.id,
    op,
    payload: pointToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

async function applyArea(
  ctx: ApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | ApplyRejection> {
  const parsed = AreaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'areas',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  if (op === 'update') {
    await assertCan(ctx.db, ctx.principal, 'edit', { type: 'area', id: row.id });
  }

  // geom_geojson is source of truth; bbox is always derived on write (DESIGN §4).
  // Vertex cap / simplify tolerance remain §13 open items (P2-B), so we do not
  // rewrite rings here — only validate structure via AreaSchema and derive bbox.
  const geom = row.geom_geojson as AreaGeometry;
  const bbox = bboxOf(geom);

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    ownerId: op === 'create' ? ctx.principal.userId : row.owner_id,
    title: row.title,
    description: row.description ?? null,
    geomGeojson: geom,
    bboxMinLat: bbox.bbox_min_lat,
    bboxMinLon: bbox.bbox_min_lon,
    bboxMaxLat: bbox.bbox_max_lat,
    bboxMaxLon: bbox.bbox_max_lon,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: now,
    updatedBy: ctx.principal.userId,
    deletedAt: row.deleted_at ?? null,
  };

  if (op === 'create') {
    await ctx.db.insert(areas).values(values);
  } else {
    await ctx.db.update(areas).set(values).where(eq(areas.id, row.id));
  }

  await appendChange(ctx.db, {
    entityType: 'areas',
    entityId: row.id,
    op,
    payload: areaToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

async function applyShare(
  ctx: ApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | ApplyRejection> {
  const parsed = ShareSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'shares',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  const resourceType = row.resource_type;
  await assertCan(ctx.db, ctx.principal, 'manage_shares', {
    type: resourceType,
    id: row.resource_id,
  });

  const values = {
    id: row.id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    granteeUserId: row.grantee_user_id,
    permission: row.permission,
    createdBy: ctx.principal.userId,
    createdAt: row.created_at,
  };

  if (op === 'create') {
    await ctx.db.insert(shares).values(values);
  } else {
    await ctx.db.update(shares).set(values).where(eq(shares.id, row.id));
  }

  await appendChange(ctx.db, {
    entityType: 'shares',
    entityId: row.id,
    op,
    payload: {
      id: row.id,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      grantee_user_id: row.grantee_user_id,
      permission: row.permission,
      created_by: values.createdBy,
      created_at: row.created_at,
    },
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

function tableToResource(
  table: SyncedTable,
): 'area' | 'place' | 'point' | 'collection' | null {
  switch (table) {
    case 'areas':
      return 'area';
    case 'places':
      return 'place';
    case 'points':
      return 'point';
    case 'collections':
      return 'collection';
    default:
      return null;
  }
}

function readId(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') {
    return raw.id;
  }
  return '00000000-0000-4000-8000-000000000000';
}

/** Postgres check / unique / FK violations (SQLSTATE class 23). */
function isPgConstraintError(err: unknown): boolean {
  let cur: unknown = err;
  for (let i = 0; i < 4 && cur; i += 1) {
    if (
      typeof cur === 'object' &&
      cur !== null &&
      'code' in cur &&
      typeof (cur as { code: unknown }).code === 'string' &&
      (cur as { code: string }).code.startsWith('23')
    ) {
      return true;
    }
    cur =
      typeof cur === 'object' && cur !== null && 'cause' in cur
        ? (cur as { cause: unknown }).cause
        : null;
  }
  return false;
}

function placeToWire(row: {
  id: string;
  ownerId: string;
  areaId: string | null;
  title: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  elevationM: number | null;
  positionSource: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
}) {
  return {
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
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ?? undefined,
  };
}

function pointToWire(row: {
  id: string;
  ownerId: string;
  placeId: string | null;
  areaId: string | null;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  elevationM: number | null;
  positionSource: string | null;
  featureKind: string | null;
  recordedAt: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
}) {
  return {
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
    recorded_at: row.recordedAt ?? undefined,
    visibility: row.visibility,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ?? undefined,
  };
}

function areaToWire(row: {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  geomGeojson: unknown;
  bboxMinLat: number;
  bboxMinLon: number;
  bboxMaxLat: number;
  bboxMaxLon: number;
  visibility: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
}) {
  return {
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
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ?? undefined,
  };
}
