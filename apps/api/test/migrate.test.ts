import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createDb, type DbHandle } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadEnv, resetEnvForTests } from '../src/env.js';

describe('startup migrations', () => {
  let handle: DbHandle | undefined;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = undefined;
    }
  });

  it('applies drizzle migrations under a PGlite data dir', { timeout: 60_000 }, async () => {
    process.env['SECRET_KEY'] = 'test-secret';
    process.env['MEDIA_ROOT'] = path.join(
      mkdtempSync(path.join(tmpdir(), 'locus-migrate-')),
      'media',
    );
    delete process.env['DATABASE_URL'];
    resetEnvForTests();
    loadEnv();

    handle = await createDb();
    await expect(runMigrations(handle)).resolves.toBeUndefined();
  });
});
