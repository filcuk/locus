/**
 * ChangeLog + readable watermark (DESIGN §5 hard part 3).
 *
 * server_seq is assigned under a single-writer advisory lock, so
 * `MAX(server_seq)` is a safe readable watermark — no out-of-order commits.
 * Pull responses expose this as WatermelonDB's `timestamp` field.
 */
import { sql } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import { changeLog } from '../db/schema.js';

const CHANGELOG_LOCK_KEY = 0x4c4f4357; // 'LOCW'

export type ChangeOp = 'create' | 'update' | 'delete';

export type ChangeLogEntry = {
  entityType: string;
  entityId: string;
  op: ChangeOp;
  payload: unknown;
  actorId: string;
  deviceId: string;
};

export async function withChangeLogWriter<T>(
  handle: DbHandle,
  fn: () => Promise<T>,
): Promise<T> {
  await handle.exec(`SELECT pg_advisory_lock(${CHANGELOG_LOCK_KEY})`);
  try {
    return await fn();
  } finally {
    await handle.exec(`SELECT pg_advisory_unlock(${CHANGELOG_LOCK_KEY})`);
  }
}

/** Fully-committed watermark (= max assigned seq under the writer lock). */
export async function getReadableWatermark(db: DbHandle['db']): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${changeLog.serverSeq}), 0)` })
    .from(changeLog);
  return Number(row?.max ?? 0);
}

export async function appendChange(
  db: DbHandle['db'],
  entry: ChangeLogEntry,
): Promise<number> {
  const createdAt = new Date().toISOString();
  const inserted = await db
    .insert(changeLog)
    .values({
      entityType: entry.entityType,
      entityId: entry.entityId,
      op: entry.op,
      payload: entry.payload,
      actorId: entry.actorId,
      deviceId: entry.deviceId,
      createdAt,
    })
    .returning();
  const row = inserted[0];
  if (row === undefined) {
    throw new Error('change_log insert returned no row');
  }
  return row.serverSeq;
}
