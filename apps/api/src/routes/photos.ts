/**
 * Photo metadata REST surface. Writes go through services/photos → syncApply
 * (DESIGN §7). Media byte upload is P3-B/C — not mounted here.
 *
 * Temporary principal injection until auth middleware lands (same as sync):
 * clients/tests send `X-Locus-User-Id` + `X-Locus-Device-Id`.
 */
import { UuidSchema } from '@locus/shared';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { DomainWriteError } from '../services/domainWriteError.js';
import { ForbiddenError } from '../services/permissions.js';
import {
  createPhoto,
  deletePhoto,
  getPhoto,
  updatePhoto,
} from '../services/photos.js';

type PhotoEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createPhotosRoutes(handle: DbHandle) {
  const app = new Hono<PhotoEnv>();

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

  app.use('/photos/*', attach);
  app.use('/photos', attach);

  app.post('/photos', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const photo = await createPhoto(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(photo, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/photos/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const photo = await getPhoto(
        c.get('db'),
        { kind: 'user', userId: c.get('userId') },
        id,
      );
      if (!photo) return c.json({ error: 'not_found' }, 404);
      return c.json(photo);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.put('/photos/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const body = await c.req.json().catch(() => null);
    try {
      const photo = await updatePhoto(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        body,
      );
      return c.json(photo);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/photos/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deletePhoto(
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

function writeError(
  c: { json: (body: unknown, status: 403 | 422) => Response },
  err: unknown,
): Response {
  if (err instanceof ForbiddenError) {
    return c.json({ error: 'FORBIDDEN', message: err.message }, 403);
  }
  if (err instanceof DomainWriteError) {
    return c.json({ error: err.code, message: err.message }, err.status);
  }
  throw err;
}
