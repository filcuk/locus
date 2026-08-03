/**
 * Pull changes since cursor, ACL-filtered at evaluation time after a
 * query-level changelog window (DESIGN §5). Echo-suppresses the caller's device.
 */
import {
  CascadeSoftDeletePayloadSchema,
  emptySyncChanges,
  SYNCED_TABLES,
  type SyncChanges,
  type SyncedTable,
} from '@locus/shared';
import { and, eq, gt, lte, ne, sql } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { changeLog, collectionItems, comments, places, taggings } from '../db/schema.js';
import { getReadableWatermark } from './changeLog.js';
import { can, type Principal } from './permissions.js';

export const SUPPORTED_SCHEMA_VERSION = 1;

export async function syncPull(
  db: DbHandle['db'],
  args: {
    cursor: number;
    deviceId: string;
    principal: Principal & { kind: 'user' };
  },
): Promise<{ changes: SyncChanges; timestamp: number }> {
  const watermark = await getReadableWatermark(db);
  const changes = emptySyncChanges();

  if (args.cursor > watermark) {
    return { changes, timestamp: watermark };
  }

  const rows = await db
    .select()
    .from(changeLog)
    .where(
      and(
        gt(changeLog.serverSeq, args.cursor),
        lte(changeLog.serverSeq, watermark),
        ne(changeLog.deviceId, args.deviceId),
      ),
    )
    .orderBy(changeLog.serverSeq);

  for (const row of rows) {
    const table = row.entityType as SyncedTable;
    if (!SYNCED_TABLES.includes(table)) continue;

    if (row.op === 'delete') {
      // Revocation and soft-delete are indistinguishable to the client (DESIGN §5).
      bag(changes, table).deleted.push(row.entityId);
      // Expand one ChangeLog cascade event into per-table deleted ids (DESIGN §4).
      const cascade = CascadeSoftDeletePayloadSchema.safeParse(row.payload);
      if (cascade.success) {
        for (const placeId of cascade.data.cascaded.places) {
          changes.places.deleted.push(placeId);
        }
        for (const pointId of cascade.data.cascaded.points) {
          changes.points.deleted.push(pointId);
        }
        for (const itemId of cascade.data.cascaded.collection_items) {
          changes.collection_items.deleted.push(itemId);
        }
      }
      continue;
    }

    if (!(await mayViewEntity(db, args.principal, table, row.entityId))) {
      continue;
    }

    const payload = row.payload;
    if (payload == null || typeof payload !== 'object') continue;

    // Payloads were validated on write; cast through unknown for the wire bag.
    if (row.op === 'create') {
      (bag(changes, table).created as unknown[]).push(payload);
    } else {
      (bag(changes, table).updated as unknown[]).push(payload);
    }
  }

  // Late-grant backfill: shares created in the window inject the resource
  // even when the resource's own server_seq is ≤ cursor (DESIGN §5 hard part 1).
  await injectLateGrants(db, args.principal, args.cursor, watermark, changes);

  return { changes, timestamp: watermark };
}

async function injectLateGrants(
  db: DbHandle['db'],
  principal: Principal & { kind: 'user' },
  cursor: number,
  watermark: number,
  changes: SyncChanges,
): Promise<void> {
  const shareChanges = await db
    .select()
    .from(changeLog)
    .where(
      and(
        gt(changeLog.serverSeq, cursor),
        lte(changeLog.serverSeq, watermark),
        eq(changeLog.entityType, 'shares'),
        sql`${changeLog.op} in ('create', 'update')`,
      ),
    );

  for (const entry of shareChanges) {
    const payload = entry.payload as {
      grantee_user_id?: string;
      resource_type?: string;
      resource_id?: string;
    } | null;
    if (!payload || payload.grantee_user_id !== principal.userId) continue;
    if (payload.resource_type !== 'place' || !payload.resource_id) continue;

    const already =
      changes.places.created.some((r) => (r as { id: string }).id === payload.resource_id) ||
      changes.places.updated.some((r) => (r as { id: string }).id === payload.resource_id);
    if (already) continue;

    if (
      !(await can(db, principal, 'view', { type: 'place', id: payload.resource_id }))
    ) {
      continue;
    }

    const [place] = await db
      .select()
      .from(places)
      .where(eq(places.id, payload.resource_id))
      .limit(1);
    if (!place || place.deletedAt) continue;

    (changes.places.created as unknown[]).push({
      id: place.id,
      owner_id: place.ownerId,
      area_id: place.areaId ?? undefined,
      title: place.title,
      description: place.description ?? undefined,
      lat: place.lat ?? undefined,
      lon: place.lon ?? undefined,
      elevation_m: place.elevationM ?? undefined,
      position_source: place.positionSource ?? undefined,
      visibility: place.visibility,
      created_at: place.createdAt,
      updated_at: place.updatedAt,
      updated_by: place.updatedBy,
      deleted_at: place.deletedAt ?? undefined,
    });
  }
}

async function mayViewEntity(
  db: DbHandle['db'],
  principal: Principal,
  table: SyncedTable,
  id: string,
): Promise<boolean> {
  switch (table) {
    case 'areas':
      return can(db, principal, 'view', { type: 'area', id });
    case 'places':
      return can(db, principal, 'view', { type: 'place', id });
    case 'points':
      return can(db, principal, 'view', { type: 'point', id });
    case 'collections':
      return can(db, principal, 'view', { type: 'collection', id });
    case 'collection_items': {
      const [item] = await db
        .select({ collectionId: collectionItems.collectionId })
        .from(collectionItems)
        .where(eq(collectionItems.id, id))
        .limit(1);
      if (!item) return false;
      return can(db, principal, 'view', { type: 'collection', id: item.collectionId });
    }
    case 'shares':
      return true; // shares targeting the user are filtered in late-grant / payload
    case 'notes':
      return can(db, principal, 'view', { type: 'note', id });
    case 'comments': {
      const [row] = await db
        .select({
          targetType: comments.targetType,
          targetId: comments.targetId,
        })
        .from(comments)
        .where(eq(comments.id, id))
        .limit(1);
      if (!row) return false;
      if (
        row.targetType !== 'area' &&
        row.targetType !== 'place' &&
        row.targetType !== 'point' &&
        row.targetType !== 'collection'
      ) {
        return false;
      }
      return can(db, principal, 'view', {
        type: row.targetType,
        id: row.targetId,
      });
    }
    case 'photos':
      return can(db, principal, 'view', { type: 'photo', id });
    case 'tags':
      return can(db, principal, 'view', { type: 'tag', id });
    case 'taggings': {
      const [row] = await db
        .select({
          targetType: taggings.targetType,
          targetId: taggings.targetId,
        })
        .from(taggings)
        .where(eq(taggings.id, id))
        .limit(1);
      if (!row) return false;
      if (
        row.targetType !== 'area' &&
        row.targetType !== 'place' &&
        row.targetType !== 'point' &&
        row.targetType !== 'collection'
      ) {
        return false;
      }
      return can(db, principal, 'view', {
        type: row.targetType,
        id: row.targetId,
      });
    }
    default:
      return false;
  }
}

function bag(changes: SyncChanges, table: SyncedTable) {
  return changes[table];
}
