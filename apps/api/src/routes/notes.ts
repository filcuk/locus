/**
 * Notes REST surface. Writes go through services/notes → syncApply (DESIGN §7).
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
  createNote,
  deleteNote,
  getNote,
  updateNote,
} from '../services/notes.js';

type NoteEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createNotesRoutes(handle: DbHandle) {
  const app = new Hono<NoteEnv>();

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

  app.use('/notes/*', attach);
  app.use('/notes', attach);

  app.post('/notes', async (c) => {
    const body = await c.req.json().catch(() => null);
    try {
      const note = await createNote(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        body,
      );
      return c.json(note, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.get('/notes/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      const note = await getNote(c.get('db'), { kind: 'user', userId: c.get('userId') }, id);
      if (!note) return c.json({ error: 'not_found' }, 404);
      return c.json(note);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.put('/notes/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    const body = await c.req.json().catch(() => null);
    try {
      const note = await updateNote(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        id,
        body,
      );
      return c.json(note);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/notes/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await deleteNote(
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
