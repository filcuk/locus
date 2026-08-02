import { and, eq, isNull } from 'drizzle-orm';

import { newEntityId } from '@locus/shared';

import type { DbHandle } from '../db/client.js';
import { passwordResetTokens, users } from '../db/schema.js';
import { env } from '../env.js';

import type { Mailer } from './mailer.js';
import { hashPassword } from './password.js';
import { revokeAllSessionsForUser } from './sessions.js';
import { hashOpaqueToken, newOpaqueToken } from './tokenHash.js';
import { secondsFromNowIso } from './ttl.js';

/** Reset tokens are short-lived relative to refresh (1 hour). */
const RESET_TTL_SECONDS = 3600;

type Db = DbHandle['db'];

/**
 * Request a password reset. Always succeeds from the caller's perspective
 * (no email enumeration). When the account exists, stores a hashed token and
 * asks the mailer to deliver the raw token.
 */
export async function requestPasswordReset(
  db: Db,
  mailer: Mailer,
  email: string,
  now = new Date(),
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const found = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  const user = found[0];
  if (!user) return;

  const raw = newOpaqueToken();
  const expiresAt = secondsFromNowIso(RESET_TTL_SECONDS, now);
  await db.insert(passwordResetTokens).values({
    id: newEntityId(),
    userId: user.id,
    tokenHash: hashOpaqueToken(raw),
    expiresAt,
    usedAt: null,
    createdAt: now.toISOString(),
  });

  const base = env().PUBLIC_BASE_URL.replace(/\/$/u, '');
  const resetUrl = `${base}/reset-password?token=${encodeURIComponent(raw)}`;
  await mailer.sendPasswordReset({
    to: normalized,
    resetToken: raw,
    resetUrl,
  });
}

export async function confirmPasswordReset(
  db: Db,
  params: { token: string; password: string; now?: Date },
): Promise<boolean> {
  const now = params.now ?? new Date();
  const nowIso = now.toISOString();
  const tokenHash = hashOpaqueToken(params.token);

  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return false;

  const passwordHash = await hashPassword(params.password);
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, row.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: nowIso })
    .where(eq(passwordResetTokens.id, row.id));
  await revokeAllSessionsForUser(db, row.userId, now);
  return true;
}
