/**
 * Place REST surface. Writes go through services/places → syncApply (DESIGN §7).
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
  createPlace,
  deletePlace,
  getPlace,
  updatePlace,
} from '../services/places.js';

type PlaceEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createPlacesRoutes(handle: DbHandle) {
  const app = new Hono<PlaceEnv>();

  app.use('/places/*', async (c, next) => {
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

  // Hono's `*` middleware does not match the collection root — attach there too.
  app.use('/places', async (c, next) => {
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

  app.post('/places', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const place = await createPlace(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(place, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/places/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const place = await getPlace(handle.db, { kind: 'user', userId: c.get('userId') }, id);
      if (!place) return c.json({ error: 'not_found' }, 404);
      return c.json(place);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.put('/places/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const body = await c.req.json().catch(() => null);
    try {
      const place = await updatePlace(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        body,
      );
      return c.json(place);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/places/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deletePlace(
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
