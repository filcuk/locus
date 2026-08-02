import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type DbHandle } from '../src/db/client.js';
import { loadEnv, resetEnvForTests } from '../src/env.js';
import { createApp } from '../src/index.js';

describe('GET /health', () => {
  let handle: DbHandle;

  beforeAll(async () => {
    process.env['SECRET_KEY'] = 'test-secret';
    process.env['MEDIA_ROOT'] = path.join(
      mkdtempSync(path.join(tmpdir(), 'locus-health-')),
      'media',
    );
    delete process.env['DATABASE_URL'];
    resetEnvForTests();
    loadEnv();
    handle = await createDb();
  }, 90_000);

  afterAll(async () => {
    await handle.close();
  });

  it('returns ok when the database answers', async () => {
    const app = createApp(handle);
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string };
    expect(body.status).toBe('ok');
    expect(body.db).toBe('pglite');
  });
});
