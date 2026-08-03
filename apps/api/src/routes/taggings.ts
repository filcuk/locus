/**
 * Taggings REST surface. Writes go through services/taggings → syncApply.
 */
import { TargetTypeSchema, UuidSchema } from '@locus/shared';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { DomainWriteError } from '../services/domainWriteError.js';
import { ForbiddenError } from '../services/permissions.js';
import {
  createTagging,
  deleteTagging,
  getTagging,
  listTaggingsForTarget,
} from '../services/taggings.js';

type TaggingEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createTaggingsRoutes(handle: DbHandle) {
  const app = new Hono<TaggingEnv>();

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

  app.use('/taggings/*', attach);
  app.use('/taggings', attach);

  app.get('/taggings', async (c) => {
    const targetTypeRaw = c.req.query('target_type');
    const targetIdRaw = c.req.query('target_id');
    const targetType = TargetTypeSchema.safeParse(targetTypeRaw);
    const targetId = UuidSchema.safeParse(targetIdRaw);
    if (!targetType.success || !targetId.success) {
      return c.json(
        {
          error: 'VALIDATION_FAILED',
          message: 'target_type and target_id query params are required',
        },
        422,
      );
    }
    try {
      const rows = await listTaggingsForTarget(
        c.get('db'),
        { kind: 'user', userId: c.get('userId') },
        targetType.data,
        targetId.data,
      );
      return c.json({ taggings: rows });
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.post('/taggings', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const tagging = await createTagging(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(tagging, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/taggings/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const tagging = await getTagging(
        c.get('db'),
        { kind: 'user', userId: c.get('userId') },
        id,
      );
      if (!tagging) return c.json({ error: 'not_found' }, 404);
      return c.json(tagging);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/taggings/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deleteTagging(
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
