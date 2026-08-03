/**
 * Photo metadata domain writes (DESIGN §4 Photos / §7).
 * Always through syncApply so REST and push share ChangeLog.
 * Byte upload / media routes are P3-B/C.
 */
import { PhotoSchema, type Photo } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { photos } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getPhoto(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Photo | null> {
  const [row] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, id), isNull(photos.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'photo', id });
  return photoRowToWire(row);
}

export async function createPhoto(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Photo> {
  const parsed = PhotoSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runPhotoApply(handle, ctx, {
    photos: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requirePhoto(handle.db, parsed.data.id);
}

export async function updatePhoto(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Photo> {
  const parsed = PhotoSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runPhotoApply(handle, ctx, {
    photos: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requirePhoto(handle.db, id);
}

export async function deletePhoto(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runPhotoApply(handle, ctx, {
    photos: { created: [], updated: [], deleted: [id] },
  });
}

async function runPhotoApply(
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

async function requirePhoto(db: DbHandle['db'], id: string): Promise<Photo> {
  const [row] = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('photo missing after successful apply');
  }
  return photoRowToWire(row);
}

function photoRowToWire(row: typeof photos.$inferSelect): Photo {
  return PhotoSchema.parse({
    id: row.id,
    owner_id: row.ownerId,
    target_type: row.targetType,
    target_id: row.targetId,
    sha256: row.sha256 ?? undefined,
    storage_key: row.storageKey ?? undefined,
    content_type: row.contentType,
    byte_size: row.byteSize ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    caption: row.caption ?? undefined,
    upload_state: row.uploadState,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
