/**
 * Shares REST surface. Writes go through services/shares → syncApply (DESIGN §4 / §7).
 *
 * Temporary principal injection until auth middleware lands (same as places):
 * clients/tests send `X-Locus-User-Id` + `X-Locus-Device-Id`.
 */
import {
  ListSharesQuerySchema,
  UuidSchema,
} from '@locus/shared';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { DomainWriteError } from '../services/domainWriteError.js';
import { ForbiddenError } from '../services/permissions.js';
import {
  createShare,
  listSharesForResource,
  revokeShare,
} from '../services/shares.js';

type ShareEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createSharesRoutes(handle: DbHandle) {
  const app = new Hono<ShareEnv>();

  app.use('/shares/*', async (c, next) => {
    const userId = c.req.header('x-locus-user-id');
    const deviceId = c.req.header('x-locus-device-id');
    if (!userId || !deviceId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('userId', userId);
    c.set('deviceId', deviceId);
    c.set('db', handle.db);
    await next();
  });

  app.use('/shares', async (c, next) => {
    const userId = c.req.header('x-locus-user-id');
    const deviceId = c.req.header('x-locus-device-id');
    if (!userId || !deviceId) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    c.set('userId', userId);
    c.set('deviceId', deviceId);
    c.set('db', handle.db);
    await next();
  });

  app.get('/shares', async (c) => {
    const query = ListSharesQuerySchema.safeParse({
      resource_type: c.req.query('resource_type'),
      resource_id: c.req.query('resource_id'),
    });
    if (!query.success) {
      return c.json({ error: 'VALIDATION_FAILED', message: query.error.message }, 422);
    }
    try {
      const shares = await listSharesForResource(
        handle.db,
        { kind: 'user', userId: c.get('userId') },
        query.data.resource_type,
        query.data.resource_id,
      );
      return c.json({ shares });
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.post('/shares', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const share = await createShare(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(share, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/shares/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await revokeShare(
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
