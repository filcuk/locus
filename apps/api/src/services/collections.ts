/**
 * Collection + CollectionItem domain writes — always through syncApply so REST
 * and push share ChangeLog (DESIGN §4 / §7). P2-C: owner-only; shares in P4.
 */
import {
  CollectionItemSchema,
  CollectionSchema,
  type Collection,
  type CollectionItem,
} from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { collectionItems, collections } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getCollection(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Collection | null> {
  const [row] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), isNull(collections.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'collection', id });
  return collectionRowToWire(row);
}

export async function createCollection(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Collection> {
  const parsed = CollectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runCollectionApply(handle, ctx, {
    collections: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireCollection(handle.db, parsed.data.id);
}

export async function updateCollection(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Collection> {
  const parsed = CollectionSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runCollectionApply(handle, ctx, {
    collections: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requireCollection(handle.db, id);
}

export async function deleteCollection(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runCollectionApply(handle, ctx, {
    collections: { created: [], updated: [], deleted: [id] },
  });
}

export async function getCollectionItem(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<CollectionItem | null> {
  const [row] = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.id, id), isNull(collectionItems.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'collection', id: row.collectionId });
  return collectionItemRowToWire(row);
}

export async function createCollectionItem(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<CollectionItem> {
  const parsed = CollectionItemSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runCollectionApply(handle, ctx, {
    collection_items: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireCollectionItem(handle.db, parsed.data.id);
}

export async function deleteCollectionItem(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runCollectionApply(handle, ctx, {
    collection_items: { created: [], updated: [], deleted: [id] },
  });
}

async function runCollectionApply(
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

async function requireCollection(db: DbHandle['db'], id: string): Promise<Collection> {
  const [row] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('collection missing after successful apply');
  }
  return collectionRowToWire(row);
}

async function requireCollectionItem(
  db: DbHandle['db'],
  id: string,
): Promise<CollectionItem> {
  const [row] = await db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.id, id))
    .limit(1);
  if (!row || row.deletedAt) {
    throw new Error('collection item missing after successful apply');
  }
  return collectionItemRowToWire(row);
}

function collectionRowToWire(row: typeof collections.$inferSelect): Collection {
  return CollectionSchema.parse({
    id: row.id,
    owner_id: row.ownerId,
    title: row.title,
    description: row.description ?? undefined,
    visibility: row.visibility,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    updated_by: row.updatedBy,
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}

function collectionItemRowToWire(
  row: typeof collectionItems.$inferSelect,
): CollectionItem {
  return CollectionItemSchema.parse({
    id: row.id,
    collection_id: row.collectionId,
    item_type: row.itemType,
    item_id: row.itemId,
    position: row.position ?? undefined,
    added_at: toIsoDateTime(row.addedAt),
    updated_at: toIsoDateTime(row.updatedAt),
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
