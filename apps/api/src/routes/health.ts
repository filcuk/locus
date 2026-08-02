import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';

export function createHealthRoutes(handle: DbHandle) {
  const app = new Hono();

  app.get('/health', async (c) => {
    try {
      await handle.exec('SELECT 1');
      return c.json({ status: 'ok', db: handle.kind });
    } catch {
      return c.json({ status: 'degraded', db: handle.kind }, 503);
    }
  });

  return app;
}
