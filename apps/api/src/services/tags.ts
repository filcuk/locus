/**
 * Tag domain writes — system (seeded, read-only) + user-private (DESIGN §4 / §7).
 * Always through syncApply so REST and push share ChangeLog.
 */
import { TagSchema, type Tag } from '@locus/shared';
import { and, eq, or } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { tags } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { retireTag, tagToWire } from './syncApplyTags.js';

export { DomainWriteError };

export async function listTags(
  db: DbHandle['db'],
  principal: Principal & { kind: 'user' },
): Promise<Tag[]> {
  const rows = await db
    .select()
    .from(tags)
    .where(
      or(
        eq(tags.scope, 'system'),
        and(eq(tags.scope, 'user'), eq(tags.ownerId, principal.userId)),
      ),
    );
  return rows.map(tagRowToWire);
}

export async function getTag(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Tag | null> {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', { type: 'tag', id });
  return tagRowToWire(row);
}

export async function createTag(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Tag> {
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.scope !== 'user') {
    throw new DomainWriteError(403, 'FORBIDDEN', 'Only user-scoped tags may be created');
  }
  await runTagApply(handle, ctx, {
    tags: { created: [parsed.data], updated: [], deleted: [] },
  });
  return requireTag(handle.db, parsed.data.id);
}

export async function updateTag(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  body: unknown,
): Promise<Tag> {
  const parsed = TagSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  if (parsed.data.id !== id) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'body id must match path id');
  }
  await runTagApply(handle, ctx, {
    tags: { created: [], updated: [parsed.data], deleted: [] },
  });
  return requireTag(handle.db, id);
}

/**
 * Soft-retire a user tag. When `stripFromAll` is true, also soft-deletes every
 * tagging that references it (DESIGN §4).
 */
export async function deleteTag(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
  stripFromAll = false,
): Promise<void> {
  await withChangeLogWriter(handle, async () => {
    const result = await retireTag(
      { ...ctx, db: handle.db },
      id,
      new Date().toISOString(),
      stripFromAll,
    );
    if (result !== 'ok') {
      throw new DomainWriteError(
        result.code === 'FORBIDDEN' ? 403 : 422,
        result.code,
        result.message,
      );
    }
  });
}

async function runTagApply(
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

async function requireTag(db: DbHandle['db'], id: string): Promise<Tag> {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!row) {
    throw new Error('tag missing after successful apply');
  }
  return tagRowToWire(row);
}

function tagRowToWire(row: typeof tags.$inferSelect): Tag {
  return TagSchema.parse(tagToWire(row));
}
