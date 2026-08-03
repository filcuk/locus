/**
 * Share domain writes — REST and sync push share ChangeLog via syncApply (DESIGN §4 / §7).
 */
import {
  CreateShareRequestSchema,
  ShareSchema,
  newEntityId,
  type Share,
} from '@locus/shared';
import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { shares } from '../db/schema.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import { assertCan, type Principal } from './permissions.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';

export { DomainWriteError };

export async function listSharesForResource(
  db: DbHandle['db'],
  principal: Principal,
  resourceType: Share['resource_type'],
  resourceId: string,
): Promise<Share[]> {
  await assertCan(db, principal, 'manage_shares', {
    type: resourceType,
    id: resourceId,
  });
  const rows = await db
    .select()
    .from(shares)
    .where(
      and(eq(shares.resourceType, resourceType), eq(shares.resourceId, resourceId)),
    );
  return rows.map(shareRowToWire);
}

export async function createShare(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
): Promise<Share> {
  const parsed = CreateShareRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }
  const now = new Date().toISOString();
  const id = parsed.data.id ?? newEntityId();
  const wire: Share = {
    id,
    resource_type: parsed.data.resource_type,
    resource_id: parsed.data.resource_id,
    grantee_user_id: parsed.data.grantee_user_id,
    permission: parsed.data.permission,
    created_by: ctx.principal.userId,
    created_at: now,
  };
  const validated = ShareSchema.parse(wire);
  await runShareApply(handle, ctx, {
    shares: { created: [validated], updated: [], deleted: [] },
  });
  return requireShare(handle.db, id);
}

export async function revokeShare(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  id: string,
): Promise<void> {
  const [row] = await handle.db.select().from(shares).where(eq(shares.id, id)).limit(1);
  if (!row) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'share not found');
  }
  await assertCan(handle.db, ctx.principal, 'manage_shares', {
    type: row.resourceType as Share['resource_type'],
    id: row.resourceId,
  });
  await runShareApply(handle, ctx, {
    shares: { created: [], updated: [], deleted: [id] },
  });
}

async function runShareApply(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  changes: Parameters<typeof syncApply>[1],
): Promise<void> {
  await withChangeLogWriter(handle, async () => {
    const result = await syncApply({ ...ctx, db: handle.db }, changes);
    if (result.rejected.length > 0) {
      const first = result.rejected[0]!;
      if (first.code === 'FORBIDDEN') {
        throw new DomainWriteError(403, 'FORBIDDEN', first.message);
      }
      throw new DomainWriteError(422, 'VALIDATION_FAILED', first.message);
    }
  });
}

async function requireShare(db: DbHandle['db'], id: string): Promise<Share> {
  const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
  if (!row) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'share missing after write');
  }
  return shareRowToWire(row);
}

export function shareRowToWire(row: typeof shares.$inferSelect): Share {
  return ShareSchema.parse({
    id: row.id,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    grantee_user_id: row.granteeUserId,
    permission: row.permission,
    created_by: row.createdBy,
    created_at: toIsoDateTime(row.createdAt),
  });
}
