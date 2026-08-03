/**
 * Tag / Tagging apply helpers for syncApply (DESIGN §4 / §5).
 */
import {
  TaggingSchema,
  TagSchema,
  type TargetType,
} from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { taggings, tags } from '../db/schema.js';
import { appendChange, type ChangeOp } from './changeLog.js';
import { assertCan, type Principal } from './permissions.js';
import { toIsoDateTime } from './timestamps.js';

export type TagsApplyContext = {
  db: DbHandle['db'];
  principal: Principal & { kind: 'user' };
  deviceId: string;
};

export type TagsRejection = {
  table: 'tags' | 'taggings';
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

function normalizeTs(value: string | Date | null | undefined): string | undefined {
  if (value == null) return undefined;
  return toIsoDateTime(value);
}

export function tagToWire(row: {
  id: string;
  scope: string;
  ownerId: string | null;
  namespace: string | null;
  label: string;
  colour: string | null;
  icon: string | null;
  retiredAt: string | Date | null;
}) {
  return {
    id: row.id,
    scope: row.scope,
    owner_id: row.ownerId ?? undefined,
    namespace: row.namespace ?? undefined,
    label: row.label,
    colour: row.colour ?? undefined,
    icon: row.icon ?? undefined,
    retired_at: normalizeTs(row.retiredAt),
  };
}

export function taggingToWire(row: {
  id: string;
  tagId: string;
  targetType: string;
  targetId: string;
  createdAt: string | Date;
  deletedAt: string | Date | null;
  tagLabel: string;
  tagColour: string | null;
  tagScope: string;
  tagNamespace: string | null;
}) {
  return {
    id: row.id,
    tag_id: row.tagId,
    target_type: row.targetType,
    target_id: row.targetId,
    created_at: toIsoDateTime(row.createdAt),
    deleted_at: normalizeTs(row.deletedAt),
    tag_label: row.tagLabel,
    tag_colour: row.tagColour ?? undefined,
    tag_scope: row.tagScope,
    tag_namespace: row.tagNamespace ?? undefined,
  };
}

export async function applyTag(
  ctx: TagsApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | TagsRejection> {
  const parsed = TagSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'tags',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;

  if (row.scope === 'system') {
    return {
      table: 'tags',
      id: row.id,
      code: 'FORBIDDEN',
      message: 'System tags are read-only',
    };
  }
  if (row.owner_id !== ctx.principal.userId) {
    return { table: 'tags', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  if (row.namespace != null) {
    return {
      table: 'tags',
      id: row.id,
      code: 'VALIDATION_FAILED',
      message: 'User tags must not set namespace',
    };
  }

  if (op === 'update') {
    try {
      await assertCan(ctx.db, ctx.principal, 'edit', { type: 'tag', id: row.id });
    } catch {
      return { table: 'tags', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
    const [existing] = await ctx.db.select().from(tags).where(eq(tags.id, row.id)).limit(1);
    if (!existing) {
      return {
        table: 'tags',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'tag not found',
      };
    }
    if (existing.scope === 'system') {
      return {
        table: 'tags',
        id: row.id,
        code: 'FORBIDDEN',
        message: 'System tags are read-only',
      };
    }
  }

  const values = {
    id: row.id,
    scope: 'user' as const,
    ownerId: ctx.principal.userId,
    namespace: null,
    label: row.label,
    colour: row.colour ?? null,
    icon: row.icon ?? null,
    retiredAt: row.retired_at ?? null,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(tags).values(values);
    } else {
      await ctx.db.update(tags).set(values).where(eq(tags.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'tags',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'tag write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'tags',
    entityId: row.id,
    op,
    payload: tagToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

export async function applyTagging(
  ctx: TagsApplyContext,
  op: ChangeOp,
  raw: unknown,
): Promise<'ok' | TagsRejection> {
  const parsed = TaggingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      table: 'taggings',
      id: readId(raw),
      code: 'VALIDATION_FAILED',
      message: parsed.error.message,
    };
  }
  const row = parsed.data;
  const targetType = row.target_type as TargetType;

  const [tag] = await ctx.db.select().from(tags).where(eq(tags.id, row.tag_id)).limit(1);
  if (!tag) {
    return {
      table: 'taggings',
      id: row.id,
      code: 'VALIDATION_FAILED',
      message: 'tag not found',
    };
  }

  if (op === 'create') {
    if (tag.retiredAt) {
      return {
        table: 'taggings',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'Cannot assign a retired tag',
      };
    }
    if (tag.scope === 'user' && tag.ownerId !== ctx.principal.userId) {
      return {
        table: 'taggings',
        id: row.id,
        code: 'FORBIDDEN',
        message: "Cannot assign another user's private tag",
      };
    }
    try {
      await assertCan(ctx.db, ctx.principal, 'edit', {
        type: targetType,
        id: row.target_id,
      });
    } catch {
      return { table: 'taggings', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
  } else {
    const [existing] = await ctx.db
      .select()
      .from(taggings)
      .where(eq(taggings.id, row.id))
      .limit(1);
    if (!existing || existing.deletedAt) {
      return {
        table: 'taggings',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'tagging not found',
      };
    }
    try {
      await assertCan(ctx.db, ctx.principal, 'edit', {
        type: existing.targetType as TargetType,
        id: existing.targetId,
      });
    } catch {
      return { table: 'taggings', id: row.id, code: 'FORBIDDEN', message: 'Forbidden' };
    }
  }

  // Always snapshot from the live Tag so clients cannot forge display fields.
  const values = {
    id: row.id,
    tagId: tag.id,
    targetType: row.target_type,
    targetId: row.target_id,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
    tagLabel: tag.label,
    tagColour: tag.colour,
    tagScope: tag.scope,
    tagNamespace: tag.namespace,
  };

  try {
    if (op === 'create') {
      await ctx.db.insert(taggings).values(values);
    } else {
      await ctx.db.update(taggings).set(values).where(eq(taggings.id, row.id));
    }
  } catch (err) {
    if (isPgConstraintError(err)) {
      return {
        table: 'taggings',
        id: row.id,
        code: 'VALIDATION_FAILED',
        message: 'tagging write violated a database constraint',
      };
    }
    throw err;
  }

  await appendChange(ctx.db, {
    entityType: 'taggings',
    entityId: row.id,
    op,
    payload: taggingToWire(values),
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });
  return 'ok';
}

/** Soft-retire a user tag (sets retired_at). Optionally strip all taggings. */
export async function retireTag(
  ctx: TagsApplyContext,
  id: string,
  now: string,
  stripFromAll: boolean,
): Promise<'ok' | TagsRejection> {
  try {
    await assertCan(ctx.db, ctx.principal, 'delete', { type: 'tag', id });
  } catch {
    return { table: 'tags', id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  const [row] = await ctx.db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!row) {
    return { table: 'tags', id, code: 'VALIDATION_FAILED', message: 'tag not found' };
  }
  if (row.scope === 'system') {
    return {
      table: 'tags',
      id,
      code: 'FORBIDDEN',
      message: 'System tags are read-only',
    };
  }

  await ctx.db.update(tags).set({ retiredAt: now }).where(eq(tags.id, id));
  const wire = tagToWire({ ...row, retiredAt: now });
  await appendChange(ctx.db, {
    entityType: 'tags',
    entityId: id,
    op: 'update',
    payload: wire,
    actorId: ctx.principal.userId,
    deviceId: ctx.deviceId,
  });

  if (stripFromAll) {
    const live = await ctx.db
      .select()
      .from(taggings)
      .where(and(eq(taggings.tagId, id), isNull(taggings.deletedAt)));
    for (const tagging of live) {
      await ctx.db
        .update(taggings)
        .set({ deletedAt: now })
        .where(eq(taggings.id, tagging.id));
      await appendChange(ctx.db, {
        entityType: 'taggings',
        entityId: tagging.id,
        op: 'delete',
        payload: taggingToWire({ ...tagging, deletedAt: now }),
        actorId: ctx.principal.userId,
        deviceId: ctx.deviceId,
      });
    }
  }

  return 'ok';
}

export async function markTaggingDeleted(
  ctx: TagsApplyContext,
  id: string,
  now: string,
): Promise<'ok' | TagsRejection> {
  const [row] = await ctx.db.select().from(taggings).where(eq(taggings.id, id)).limit(1);
  if (!row || row.deletedAt) {
    return {
      table: 'taggings',
      id,
      code: 'VALIDATION_FAILED',
      message: 'tagging not found',
    };
  }
  try {
    await assertCan(ctx.db, ctx.principal, 'edit', {
      type: row.targetType as TargetType,
      id: row.targetId,
    });
  } catch {
    return { table: 'taggings', id, code: 'FORBIDDEN', message: 'Forbidden' };
  }
  await ctx.db
    .update(taggings)
    .set({ deletedAt: now })
    .where(eq(taggings.id, id));
  return 'ok';
}
