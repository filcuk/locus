import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { env } from '../env.js';
import * as schema from './schema.js';

type PgDb = ReturnType<typeof drizzlePg<typeof schema>>;
type PgliteDb = ReturnType<typeof drizzlePglite<typeof schema>>;

export type DbHandle = {
  db: PgDb | PgliteDb;
  /** Run raw SQL (advisory locks, health probes). */
  exec: (sql: string, params?: unknown[]) => Promise<unknown>;
  /** Close pools / embedded engine. */
  close: () => Promise<void>;
  kind: 'postgres' | 'pglite';
};

/**
 * Select embedded PGlite or external Postgres from DATABASE_URL (DESIGN §7).
 * PGlite lives under the data root beside MEDIA_ROOT (DESIGN §9).
 */
export async function createDb(): Promise<DbHandle> {
  const config = env();
  if (config.DATABASE_URL) {
    return createPostgres(config.DATABASE_URL);
  }
  const dataRoot = dirname(config.MEDIA_ROOT);
  const pgliteDir = join(dataRoot, 'pglite');
  mkdirSync(pgliteDir, { recursive: true });
  return createPglite(pgliteDir);
}

function createPostgres(connectionString: string): DbHandle {
  const pool = new pg.Pool({ connectionString });
  const db = drizzlePg(pool, { schema });
  return {
    db,
    kind: 'postgres',
    async exec(sql, params = []) {
      await pool.query(sql, params);
    },
    async close() {
      await pool.end();
    },
  };
}

async function createPglite(dataDir: string): Promise<DbHandle> {
  const client = new PGlite(dataDir);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  return {
    db,
    kind: 'pglite',
    async exec(sql, params = []) {
      await client.query(sql, params);
    },
    async close() {
      await client.close();
    },
  };
}
