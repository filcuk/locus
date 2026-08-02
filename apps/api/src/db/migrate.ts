import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';

import type { DbHandle } from './client.js';

/** Stable advisory-lock key for startup migrations (DESIGN §7). */
const MIGRATION_LOCK_KEY = 0x4c4f4355; // 'LOCU'

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

/**
 * Apply Drizzle migrations at startup behind a Postgres advisory lock (DESIGN §7).
 * Never destructive on the default path — only forward migrations.
 */
export async function runMigrations(handle: DbHandle): Promise<void> {
  await handle.exec(`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    if (handle.kind === 'postgres') {
      await migratePg(handle.db as Parameters<typeof migratePg>[0], { migrationsFolder });
    } else {
      await migratePglite(handle.db as Parameters<typeof migratePglite>[0], {
        migrationsFolder,
      });
    }
  } finally {
    await handle.exec(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
  }
}
