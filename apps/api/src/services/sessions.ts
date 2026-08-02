import { newEntityId } from '@locus/shared';
import { and, eq, isNull } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { sessions } from '../db/schema.js';
import { env } from '../env.js';

import { hashOpaqueToken, newOpaqueToken } from './tokenHash.js';
import { parseTtlToSeconds, secondsFromNowIso } from './ttl.js';

export type IssuedSession = {
  sessionId: string;
  refreshToken: string;
  expiresAt: string;
};

type Db = DbHandle['db'];

export async function createSession(
  db: Db,
  params: { userId: string; deviceId: string; now?: Date },
): Promise<IssuedSession> {
  const now = params.now ?? new Date();
  const refreshToken = newOpaqueToken();
  const sessionId = newEntityId();
  const expiresAt = secondsFromNowIso(
    parseTtlToSeconds(env().REFRESH_TOKEN_TTL),
    now,
  );

  await db.insert(sessions).values({
    id: sessionId,
    userId: params.userId,
    tokenHash: hashOpaqueToken(refreshToken),
    deviceId: params.deviceId,
    expiresAt,
    revokedAt: null,
  });

  return { sessionId, refreshToken, expiresAt };
}

/**
 * Validate refresh token + device binding, revoke the old row, issue a new one
 * (single-use rotation — DESIGN §10).
 */
export async function rotateSession(
  db: Db,
  params: { refreshToken: string; deviceId: string; now?: Date },
): Promise<{ userId: string; session: IssuedSession } | null> {
  const now = params.now ?? new Date();
  const tokenHash = hashOpaqueToken(params.refreshToken);
  const nowIso = now.toISOString();

  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.deviceId !== params.deviceId) return null;
  if (new Date(row.expiresAt).getTime() <= now.getTime()) return null;

  await db
    .update(sessions)
    .set({ revokedAt: nowIso })
    .where(eq(sessions.id, row.id));

  const session = await createSession(db, {
    userId: row.userId,
    deviceId: params.deviceId,
    now,
  });
  return { userId: row.userId, session };
}

export async function revokeSessionByRefreshToken(
  db: Db,
  refreshToken: string,
  now = new Date(),
): Promise<boolean> {
  const tokenHash = hashOpaqueToken(refreshToken);
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  await db
    .update(sessions)
    .set({ revokedAt: now.toISOString() })
    .where(eq(sessions.id, row.id));
  return true;
}

/** Revoke every active session for a user (e.g. after password reset). */
export async function revokeAllSessionsForUser(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now.toISOString() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
