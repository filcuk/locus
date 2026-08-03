/**
 * Comment domain writes — collaborative; visibility follows target view
 * (DESIGN §4 / §7). Always through syncApply.
 */
import { CommentSchema, type Comment } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { comments } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getComment(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Comment | null> {
  const [row] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
    .limit(1);
  if (!row) return null;
  if (
    row.targetType !== 'area' &&
    row.targetType !== 'place' &&
    row.targetType !== 'point' &&
    row.targetType !== 'collection'
  ) {
    return null;
  }
  await assertCan(db, principal, 'view', {
    type: row.targetType,
    id: row.targetId,
  });
  return commentRowToWire(row);
}

export async function createComment(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Comment> {
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runCommentApply(handle, ctx, {
    comments: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireComment(handle.db, parsed.data.id);
}

export async function updateComment(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Comment> {
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runCommentApply(handle, ctx, {
    comments: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requireComment(handle.db, id);
}

export async function deleteComment(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runCommentApply(handle, ctx, {
    comments: { created: [], updated: [], deleted: [id] },
  });
}

async function runCommentApply(
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

async function requireComment(db: DbHandle['db'], id: string): Promise<Comment> {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('comment missing after successful apply');
  }
  return commentRowToWire(row);
}

function commentRowToWire(row: typeof comments.$inferSelect): Comment {
  return CommentSchema.parse({
    id: row.id,
    author_id: row.authorId,
    target_type: row.targetType,
    target_id: row.targetId,
    body: row.body,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
