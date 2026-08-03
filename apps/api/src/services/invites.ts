/**
 * Email invites for users without accounts yet (DESIGN §4 / §7).
 * Tokens stored hashed only; raw GUID returned once on create (DESIGN §10).
 */
import {
  AcceptInviteRequestSchema,
  CreateInviteRequestSchema,
  InvitePublicSchema,
  ShareSchema,
  newEntityId,
  type AcceptInviteResponse,
  type CreateInviteResponse,
  type InvitePublic,
  type Share,
} from '@locus/shared';
import { and, eq } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { invites, shares, users } from '../db/schema.js';
import { env } from '../env.js';
import { withChangeLogWriter } from './changeLog.js';
import { DomainWriteError } from './domainWriteError.js';
import type { Mailer } from './mailer.js';
import { assertCan, type Principal } from './permissions.js';
import { shareRowToWire } from './shares.js';
import { syncApply, type ApplyContext } from './syncApply.js';
import { toIsoDateTime } from './timestamps.js';
import { hashOpaqueToken, newOpaqueToken } from './tokenHash.js';
import { secondsFromNowIso } from './ttl.js';

/** Invites last 7 days unless DESIGN specifies otherwise. */
const INVITE_TTL_SECONDS = 7 * 24 * 3600;

type Db = DbHandle['db'];

export async function listInvitesForResource(
  db: Db,
  principal: Principal,
  resourceType: Share['resource_type'],
  resourceId: string,
): Promise<InvitePublic[]> {
  await assertCan(db, principal, 'manage_shares', {
    type: resourceType,
    id: resourceId,
  });
  const rows = await db
    .select()
    .from(invites)
    .where(
      and(eq(invites.resourceType, resourceType), eq(invites.resourceId, resourceId)),
    );
  return rows.map(inviteRowToPublic);
}

/**
 * Create an invite. If the email already has an account, mint a Share instead
 * (Invite is for “no account yet” — DESIGN §4).
 */
export async function createInvite(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  mailer: Mailer,
  body: unknown,
  now = new Date(),
): Promise<CreateInviteResponse> {
  const parsed = CreateInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }

  await assertCan(handle.db, ctx.principal, 'manage_shares', {
    type: parsed.data.resource_type,
    id: parsed.data.resource_id,
  });

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await handle.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const existingUser = existing[0];

  if (existingUser) {
    const share = await createShareForUser(handle, ctx, {
      resourceType: parsed.data.resource_type,
      resourceId: parsed.data.resource_id,
      granteeUserId: existingUser.id,
      permission: parsed.data.permission,
      id: parsed.data.id,
    });
    return { kind: 'share', share };
  }

  const raw = newOpaqueToken();
  const id = parsed.data.id ?? newEntityId();
  const expiresAt = secondsFromNowIso(INVITE_TTL_SECONDS, now);
  await handle.db.insert(invites).values({
    id,
    email,
    resourceType: parsed.data.resource_type,
    resourceId: parsed.data.resource_id,
    permission: parsed.data.permission,
    tokenHash: hashOpaqueToken(raw),
    expiresAt,
    createdBy: ctx.principal.userId,
  });

  const invite = inviteRowToPublic({
    id,
    email,
    resourceType: parsed.data.resource_type,
    resourceId: parsed.data.resource_id,
    permission: parsed.data.permission,
    expiresAt,
    createdBy: ctx.principal.userId,
  });

  const base = env().PUBLIC_BASE_URL.replace(/\/$/u, '');
  const inviteUrl = `${base}/invites/accept?token=${encodeURIComponent(raw)}`;
  await mailer.sendInvite({
    to: email,
    inviteToken: raw,
    inviteUrl,
  });

  return { kind: 'invite', invite, token: raw };
}

export async function revokeInvite(
  db: Db,
  principal: Principal,
  id: string,
): Promise<void> {
  const [row] = await db.select().from(invites).where(eq(invites.id, id)).limit(1);
  if (!row) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'invite not found');
  }
  await assertCan(db, principal, 'manage_shares', {
    type: row.resourceType as Share['resource_type'],
    id: row.resourceId,
  });
  await db.delete(invites).where(eq(invites.id, id));
}

/**
 * Authenticated redeem: caller's email must match the invite email.
 * Creates a Share and deletes the Invite (token never logged).
 */
export async function acceptInvite(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  body: unknown,
  now = new Date(),
): Promise<AcceptInviteResponse> {
  const parsed = AcceptInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', parsed.error.message);
  }

  const [user] = await handle.db
    .select()
    .from(users)
    .where(eq(users.id, ctx.principal.userId))
    .limit(1);
  if (!user) {
    throw new DomainWriteError(403, 'FORBIDDEN', 'Forbidden');
  }

  const tokenHash = hashOpaqueToken(parsed.data.token);
  const [invite] = await handle.db
    .select()
    .from(invites)
    .where(eq(invites.tokenHash, tokenHash))
    .limit(1);
  if (!invite) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'invite not found or expired');
  }
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) {
    await handle.db.delete(invites).where(eq(invites.id, invite.id));
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'invite not found or expired');
  }
  if (invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    throw new DomainWriteError(403, 'FORBIDDEN', 'Forbidden');
  }

  // Apply as the inviter so manage_shares passes; the redeeming user is authorised
  // by the hashed token + matching email (DESIGN §4 Invite).
  const share = await createShareForUser(
    handle,
    {
      principal: { kind: 'user', userId: invite.createdBy },
      deviceId: ctx.deviceId,
    },
    {
      resourceType: invite.resourceType as Share['resource_type'],
      resourceId: invite.resourceId,
      granteeUserId: user.id,
      permission: invite.permission as Share['permission'],
    },
  );
  await handle.db.delete(invites).where(eq(invites.id, invite.id));
  return { share };
}

async function createShareForUser(
  handle: DbHandle,
  ctx: Omit<ApplyContext, 'db'>,
  params: {
    resourceType: Share['resource_type'];
    resourceId: string;
    granteeUserId: string;
    permission: Share['permission'];
    id?: string;
  },
): Promise<Share> {
  const now = new Date().toISOString();
  const id = params.id ?? newEntityId();
  const wire = ShareSchema.parse({
    id,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    grantee_user_id: params.granteeUserId,
    permission: params.permission,
    created_by: ctx.principal.userId,
    created_at: now,
  });

  await withChangeLogWriter(handle, async () => {
    const result = await syncApply({ ...ctx, db: handle.db }, {
      shares: { created: [wire], updated: [], deleted: [] },
    });
    if (result.rejected.length > 0) {
      const first = result.rejected[0]!;
      if (first.code === 'FORBIDDEN') {
        throw new DomainWriteError(403, 'FORBIDDEN', first.message);
      }
      throw new DomainWriteError(422, 'VALIDATION_FAILED', first.message);
    }
  });

  const [row] = await handle.db.select().from(shares).where(eq(shares.id, id)).limit(1);
  if (!row) {
    throw new DomainWriteError(422, 'VALIDATION_FAILED', 'share missing after write');
  }
  return shareRowToWire(row);
}

function inviteRowToPublic(row: {
  id: string;
  email: string;
  resourceType: string;
  resourceId: string;
  permission: string;
  expiresAt: string;
  createdBy: string;
}): InvitePublic {
  return InvitePublicSchema.parse({
    id: row.id,
    email: row.email,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    permission: row.permission,
    expires_at: toIsoDateTime(row.expiresAt),
    created_by: row.createdBy,
  });
}
