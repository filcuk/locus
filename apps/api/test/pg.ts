import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { createDb, type DbHandle } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv, resetEnvForTests } from '../src/env.js';

export type PgFixture = {
  container: StartedPostgreSqlContainer;
  handle: DbHandle;
};

/** Start Postgres 16 via Testcontainers and apply API migrations. */
export async function startPostgresFixture(): Promise<PgFixture> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env['DATABASE_URL'] = container.getConnectionUri();
  process.env['SECRET_KEY'] = 'test-secret';
  process.env['MEDIA_ROOT'] = '/tmp/locus-pg-media';
  resetEnvForTests();
  loadEnv();
  const handle = await createDb();
  await runMigrations(handle);
  return { container, handle };
}

export async function stopPostgresFixture(fixture: PgFixture): Promise<void> {
  await fixture.handle.close();
  await fixture.container.stop();
  delete process.env['DATABASE_URL'];
  resetEnvForTests();
}
