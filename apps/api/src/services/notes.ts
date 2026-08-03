/**
 * Note domain writes — personal timeline, author-only (DESIGN §4 / §7).
 * Always through syncApply so REST and push share ChangeLog.
 */
import { NoteSchema, type Note } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { notes } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function getNote(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Note | null> {
  const [row] = await db
    .select()
    .from(notes)
    .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'note', id });
  return noteRowToWire(row);
}

export async function createNote(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Note> {
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  await runNoteApply(handle, ctx, {
    notes: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireNote(handle.db, parsed.data.id);
}

export async function updateNote(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Note> {
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runNoteApply(handle, ctx, {
    notes: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requireNote(handle.db, id);
}

export async function deleteNote(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runNoteApply(handle, ctx, {
    notes: { created: [], updated: [], deleted: [id] },
  });
}

async function runNoteApply(
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

async function requireNote(db: DbHandle['db'], id: string): Promise<Note> {
  const [row] = await db.select().from(notes).where(eq(notes.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('note missing after successful apply');
  }
  return noteRowToWire(row);
}

function noteRowToWire(row: typeof notes.$inferSelect): Note {
  return NoteSchema.parse({
    id: row.id,
    author_id: row.authorId,
    target_type: row.targetType,
    target_id: row.targetId,
    body: row.body ?? undefined,
    visited_at: row.visitedAt ? toIsoDateTime(row.visitedAt) : undefined,
    created_at: toIsoDateTime(row.createdAt),
    updated_at: toIsoDateTime(row.updatedAt),
    deleted_at: row.deletedAt ? toIsoDateTime(row.deletedAt) : undefined,
  });
}
