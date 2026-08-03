/**
 * Photo metadata apply helpers for syncApply (DESIGN §4 Photos / §5).
 * Bytes / derivatives are P3-B/C — this path only writes metadata rows.
 */
import {
  PhotoSchema,
  canTransitionUploadState,
  type TargetType,
  type UploadState,
} from '@locus/shared';
import { eq } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { photos } from '../db/schema.js';
import { appendChange, type ChangeOp } from './changeLog.js';
import { assertCan, type Principal } from './permissions.js';

export type PhotosApplyContext = {
  db: DbHandle['db'];
  principal: Principal & { kind: 'user' };
  deviceId: string;
};

export type PhotosRejection = {
  table: 'photos';
  id: string;
  code: 'FORBIDDEN' | 'VALIDATION_FAILED';
  message: string;
};

function readId(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string') {
    return raw.id;
  }
  return '00000000-0000-4000-8000-000000000000';
}

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

export function photoToWire(row: {
  id: string;
  ownerId: string;
  targetType: string;
  targetId: string;
  sha256: string | null;
  storageKey: string | null;
  contentType: string;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  uploadState: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}) {
  return {
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
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt ?? undefined,
  };
}

export async function applyPhoto(
  ctx: PhotosApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | PhotosRejection> {
  const parsed = PhotoSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'photos',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  const targetType = row.target_type as TargetType;

  if (op === 'create') {
    if (row.owner_id !== ctx.principal.userId) {
      return { table: 'photos', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
    await assertCan(ctx.db, ctx.principal, 'create_child', {
      type: targetType,
      id: row.target_id,
    });
  } else {
    await assertCan(ctx.db, ctx.principal, 'edit', { type: 'photo', id: row.id });
    const [existing] = await ctx.db
      .select()
      .from(photos)
      .where(eq(photos.id, row.id))
      .limit(1);
    if (!existing || existing.deletedAt) {
      return {
        table: 'photos',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'photo not found',
      };
    }
    if (existing.ownerId !== ctx.principal.userId) {
      return { table: 'photos', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
    // Owner cannot reassign ownership or retarget via update.
    if (row.owner_id !== existing.ownerId) {
      return { table: 'photos', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
    if (
      row.target_type !== existing.targetType ||
      row.target_id !== existing.targetId
    ) {
      return {
        table: 'photos',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'photo target cannot change',
      };
    }
    const from = existing.uploadState as UploadState;
    const to = row.upload_state;
    if (!canTransitionUploadState(from, to)) {
      return {
        table: 'photos',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: `invalid upload_state transition ${from} → ${to}`,
      };
    }
  }

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    ownerId: op === 'create' ? ctx.principal.userId : row.owner_id,
    targetType: row.target_type,
    targetId: row.target_id,
    sha256: row.sha256 ?? null,
    storageKey: row.storage_key ?? null,
    contentType: row.content_type,
    byteSize: row.byte_size ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    caption: row.caption ?? null,
    uploadState: row.upload_state,
    createdAt: row.created_at,
    updatedAt: now,
    deletedAt: row.deleted_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(photos).values(values);
    } else {
      await ctx.db.update(photos).set(values).where(eq(photos.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'photos',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'photo write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'photos',
    entityId: row.id,
    op,
    payload: photoToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

/** Soft-delete only — caller emits ChangeLog. */
export async function markPhotoDeleted(
  ctx: PhotosApplyContext,
  id: string,
  now: string,
): Promise<'ok' | PhotosRejection> {
  try {
    await assertCan(ctx.db, ctx.principal, 'delete', { type: 'photo', id });
  } catch {
    return { table: 'photos', id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  await ctx.db
    .update(photos)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(photos.id, id));
  return 'ok';
}
