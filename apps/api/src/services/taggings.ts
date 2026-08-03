/**
 * Tagging domain writes — assign tags to area/place/point/collection (DESIGN §4).
 */
import {
  TaggingSchema,
  TargetTypeSchema,
  UuidSchema,
  IsoDateTimeSchema,
  type Tagging,
  type TargetType,
} from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import type { DbHandle } from '../db/client.js';
import { taggings, tags } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { taggingToWire } from './syncApplyTags.js';

export { DomainWriteError };

/** Create body may omit denormalised chip fields — server copies them from Tag. */
const CreateTaggingBodySchema = z.object({
  id: UuidSchema,
  tag_id: UuidSchema,
  target_type: TargetTypeSchema,
  target_id: UuidSchema,
  created_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
  tag_label: z.string().min(1).optional(),
  tag_colour: z.string().nullable().optional(),
  tag_scope: z.enum(['system', 'user']).optional(),
  tag_namespace: z.string().min(1).nullable().optional(),
});

export async function listTaggingsForTarget(
  db: DbHandle['db'],
  principal: Principal,
  targetType: TargetType,
  targetId: string,
): Promise<Tagging[]> {
  await assertCan(db, principal, 'view', { type: targetType, id: targetId });
  const rows = await db
    .select()
    .from(taggings)
    .where(
      and(
        eq(taggings.targetType, targetType),
        eq(taggings.targetId, targetId),
        isNull(taggings.deletedAt),
      ),
    );
  return rows.map((row) => TaggingSchema.parse(taggingToWire(row)));
}

export async function getTagging(
  db: DbHandle['db'],
  principal: Principal,
  id: string,
): Promise<Tagging | null> {
  const [row] = await db
    .select()
    .from(taggings)
    .where(and(eq(taggings.id, id), isNull(taggings.deletedAt)))
    .limit(1);
  if (!row) return null;
  await assertCan(db, principal, 'view', {
    type: row.targetType as TargetType,
    id: row.targetId,
  });
  return TaggingSchema.parse(taggingToWire(row));
}

export async function createTagging(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Tagging> {
  const parsed = CreateTaggingBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  const [tag] = await handle.db
    .select()
    .from(tags)
    .where(eq(tags.id, parsed.data.tag_id))
    .limit(1);
  if (!tag) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'tag not found');
  }
  const hydrated = TaggingSchema.parse({
    ...parsed.data,
    tag_label: tag.label,
    tag_colour: tag.colour ?? undefined,
    tag_scope: tag.scope === 'user' ? 'user' : 'system',
    tag_namespace: tag.namespace ?? undefined,
  });
  await runTaggingApply(handle, ctx, {
    taggings: { created: [hydrated], updated: [], deleted: [] },
  });
  return requireTagging(handle.db, hydrated.id);
}

export async function deleteTagging(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  await runTaggingApply(handle, ctx, {
    taggings: { created: [], updated: [], deleted: [id] },
  });
}

async function runTaggingApply(
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

async function requireTagging(db: DbHandle['db'], id: string): Promise<Tagging> {
  const [row] = await db.select().from(taggings).where(eq(taggings.id, id)).limit(1);
  if (!row || row.deletedAt) {
    throw new Error('tagging missing after successful apply');
  }
  return TaggingSchema.parse(taggingToWire(row));
}
