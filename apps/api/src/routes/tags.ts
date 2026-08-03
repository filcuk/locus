/**
 * Tags REST surface. Writes go through services/tags → syncApply (DESIGN §7).
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
  createTag,
  deleteTag,
  getTag,
  listTags,
  updateTag,
} from '../services/tags.js';

type TagEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createTagsRoutes(handle: DbHandle) {
  const app = new Hono<TagEnv>();

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

  app.use('/tags/*', attach);
  app.use('/tags', attach);

  app.get('/tags', async (c) => {
    const tags = await listTags(c.get('db'), {
      kind: 'user',
      userId: c.get('userId'),
    });
    return c.json({ tags });
  });

  app.post('/tags', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const tag = await createTag(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(tag, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/tags/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const tag = await getTag(c.get('db'), { kind: 'user', userId: c.get('userId') }, id);
      if (!tag) return c.json({ error: 'not_found' }, 404);
      return c.json(tag);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.put('/tags/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const body = await c.req.json().catch(() => null);
    try {
      const tag = await updateTag(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        body,
      );
      return c.json(tag);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/tags/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const stripRaw = c.req.query('strip_from_all');
    const stripFromAll = stripRaw === '1' || stripRaw === 'true';
    try {
      await deleteTag(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        stripFromAll,
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
