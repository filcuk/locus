/**
 * Note / comment apply helpers for syncApply (DESIGN §4 / §5).
 * Kept separate so the shared write path stays readable.
 */
import {
  CommentSchema,
  NoteSchema,
  type TargetType,
} from '@locus/shared';
import { eq } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { comments, notes } from '../db/schema.js';
import { appendChange, type ChangeOp } from './changeLog.js';
import { assertCan, type Principal } from './permissions.js';

export type NotesCommentsApplyContext = {
  db: DbHandle['db'];
  principal: Principal & { kind: 'user' };
  deviceId: string;
};

export type NotesCommentsRejection = {
  table: 'notes' | 'comments';
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

export function noteToWire(row: {
  id: string;
  authorId: string;
  targetType: string;
  targetId: string;
  body: string | null;
  visitedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}) {
  return {
    id: row.id,
    author_id: row.authorId,
    target_type: row.targetType,
    target_id: row.targetId,
    body: row.body ?? undefined,
    visited_at: row.visitedAt ?? undefined,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt ?? undefined,
  };
}

export function commentToWire(row: {
  id: string;
  authorId: string;
  targetType: string;
  targetId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}) {
  return {
    id: row.id,
    author_id: row.authorId,
    target_type: row.targetType,
    target_id: row.targetId,
    body: row.body,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    deleted_at: row.deletedAt ?? undefined,
  };
}

export async function applyNote(
  ctx: NotesCommentsApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | NotesCommentsRejection> {
  const parsed = NoteSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'notes',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  if (row.author_id !== ctx.principal.userId) {
    return { table: 'notes', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
  }

  const targetType = row.target_type as TargetType;
  if (op === 'create') {
    await assertCan(ctx.db, ctx.principal, 'view', {
      type: targetType,
      id: row.target_id,
    });
  } else {
    await assertCan(ctx.db, ctx.principal, 'edit', { type: 'note', id: row.id });
  }

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    authorId: row.author_id,
    targetType: row.target_type,
    targetId: row.target_id,
    body: row.body ?? null,
    visitedAt: row.visited_at ?? null,
    createdAt: row.created_at,
    updatedAt: now,
    deletedAt: row.deleted_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(notes).values(values);
    } else {
      await ctx.db.update(notes).set(values).where(eq(notes.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'notes',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'note write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'notes',
    entityId: row.id,
    op,
    payload: noteToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

export async function applyComment(
  ctx: NotesCommentsApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | NotesCommentsRejection> {
  const parsed = CommentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'comments',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  if (row.author_id !== ctx.principal.userId) {
    return { table: 'comments', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
  }

  const targetType = row.target_type as TargetType;
  if (op === 'create') {
    await assertCan(ctx.db, ctx.principal, 'comment', {
      type: targetType,
      id: row.target_id,
    });
  } else {
    const [existing] = await ctx.db
      .select()
      .from(comments)
      .where(eq(comments.id, row.id))
      .limit(1);
    if (!existing || existing.deletedAt) {
      return {
        table: 'comments',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'comment not found',
      };
    }
    if (existing.authorId !== ctx.principal.userId) {
      return { table: 'comments', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
    await assertCan(ctx.db, ctx.principal, 'view', {
      type: targetType,
      id: row.target_id,
    });
  }

  const now = new Date().toISOString();
  const values = {
    id: row.id,
    authorId: row.author_id,
    targetType: row.target_type,
    targetId: row.target_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: now,
    deletedAt: row.deleted_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(comments).values(values);
    } else {
      await ctx.db.update(comments).set(values).where(eq(comments.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'comments',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'comment write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'comments',
    entityId: row.id,
    op,
    payload: commentToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

/** Soft-delete only — caller emits ChangeLog. */
export async function markNoteDeleted(
  ctx: NotesCommentsApplyContext,
  id: string,
  now: string,
): Promise<'ok' | NotesCommentsRejection> {
  try {
    await assertCan(ctx.db, ctx.principal, 'delete', { type: 'note', id });
  } catch {
    return { table: 'notes', id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  await ctx.db
    .update(notes)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(notes.id, id));
  return 'ok';
}

/** Soft-delete only — caller emits ChangeLog. */
export async function markCommentDeleted(
  ctx: NotesCommentsApplyContext,
  id: string,
  now: string,
): Promise<'ok' | NotesCommentsRejection> {
  const [row] = await ctx.db.select().from(comments).where(eq(comments.id, id)).limit(1);
  if (!row || row.deletedAt) {
    return { table: 'comments', id, code: 'VALIDATION_FAILED', message: 'comment not found' };
  }
  if (row.authorId !== ctx.principal.userId) {
    return { table: 'comments', id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  await ctx.db
    .update(comments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(comments.id, id));
  return 'ok';
}
