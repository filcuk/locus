/**
 * Collection + CollectionItem REST surface. Writes go through
 * services/collections → syncApply (DESIGN §7).
 *
 * Temporary principal injection until auth middleware lands (same as sync):
 * clients/tests send `X-Locus-User-Id` + `X-Locus-Device-Id`.
 */
import { UuidSchema } from '@locus/shared';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { ForbiddenError } from '../services/permissions.js';
import { DomainWriteError } from '../services/domainWriteError.js';
import {
  createCollection,
  createCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  getCollection,
  getCollectionItem,
  updateCollection,
} from '../services/collections.js';

type CollectionEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createCollectionsRoutes(handle: DbHandle) {
  const app = new Hono<CollectionEnv>();

  const attach = async (
    c: {
      req: { header: (name: string) => string | undefined };
      set: (k: 'userId' | 'deviceId' | 'db', v: unknown) => void;
      json: (body: unknown, status: 401) => Response;
    },
    next: () => Promise<void>,
  ) => {
    const userId = c.req.header('x-locus-user-id');
    const deviceId = c.req.header('x-locus-device-id');
    if (!userId || !deviceId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('userId', userId);
    c.set('deviceId', deviceId);
    c.set('db', handle.db);
    await next();
  };

  app.use('/collections/*', attach);
  app.use('/collections', attach);
  app.use('/collection-items/*', attach);
  app.use('/collection-items', attach);

  app.post('/collections', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const collection = await createCollection(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(collection, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/collections/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const collection = await getCollection(
        handle.db,
        { kind: 'user', userId: c.get('userId') },
        id,
      );
      if (!collection) return c.json({ error: 'not_found' }, 404);
      return c.json(collection);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.put('/collections/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const body = await c.req.json().catch(() => null);
    try {
      const collection = await updateCollection(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        body,
      );
      return c.json(collection);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/collections/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deleteCollection(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
      );
      return c.body(null, 204);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.post('/collection-items', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const item = await createCollectionItem(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(item, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/collection-items/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const item = await getCollectionItem(
        handle.db,
        { kind: 'user', userId: c.get('userId') },
        id,
      );
      if (!item) return c.json({ error: 'not_found' }, 404);
      return c.json(item);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/collection-items/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deleteCollectionItem(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
      );
      return c.body(null, 204);
    } catch (err) {
      return writeError(c, err);
    }
  });

  return app;
}

function parseId(raw: string): string | null {
  const parsed = UuidSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function writeError(c: { json: (body: unknown, status: 403 | 422) => Response }, err: unknown) {
  if (err instanceof DomainWriteError) {
    return c.json({ error: err.code, message: err.message }, err.status);
  }
  if (err instanceof ForbiddenError) {
    return c.json({ error: 'FORBIDDEN', message: 'Forbidden' }, 403);
  }
  throw err;
}
