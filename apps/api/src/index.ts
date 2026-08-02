import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { Hono } from 'hono';

import { createDb, type DbHandle } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { env, loadEnv } from './env.js';
import { createAuthRoutes } from './routes/auth.js';
import { createHealthRoutes } from './routes/health.js';
import { createPlacesRoutes } from './routes/places.js';
import { createPointsRoutes } from './routes/points.js';
import { createSyncRoutes } from './routes/sync.js';
import { createMailer, type Mailer } from './services/mailer.js';

export type AppVariables = {
  db: DbHandle['db'];
};

export type CreateAppOptions = {
  mailer?: Mailer;
  now?: () => Date;
};

export function createApp(handle: DbHandle, options: CreateAppOptions = {}) {
  const app = new Hono<{ Variables: AppVariables }>();
  const mailer = options.mailer ?? createMailer();

  app.use('*', async (c, next) => {
    c.set('db', handle.db);
    await next();
  });

  app.route('/', createHealthRoutes(handle));
  app.route('/', createAuthRoutes(handle, { mailer, now: options.now }));
  app.route('/', createPlacesRoutes(handle));
  app.route('/', createPointsRoutes(handle));
  app.route('/', createSyncRoutes(handle));

  app.get('/', (c) =>
    c.json({
      name: 'locus-api',
      mapStyleUrl: env().MAP_STYLE_URL,
    }),
  );

  return app;
}

async function main(): Promise<void> {
  loadEnv();
  const handle = await createDb();
  await runMigrations(handle);

  const app = createApp(handle);
  const port = env().PORT;

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(JSON.stringify({ msg: 'listening', port: info.port, db: handle.kind }));
  });
}

const thisFile = fileURLToPath(import.meta.url);
const invokedAs =
  process.argv[1] !== undefined ? path.resolve(process.argv[1]) : undefined;
const isDirectRun = invokedAs === thisFile;

if (isDirectRun) {
  main().catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : 'startup failed';
    console.error(JSON.stringify({ msg: 'fatal', error: message }));
    process.exit(1);
  });
}