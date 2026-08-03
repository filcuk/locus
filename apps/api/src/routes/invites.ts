/**
 * Invites REST surface (DESIGN §4 / §7). Accept redeems a hashed token.
 *
 * Temporary principal injection until auth middleware lands (same as places):
 * clients/tests send `X-Locus-User-Id` + `X-Locus-Device-Id`.
 */
import {
  AcceptInviteRequestSchema,
  CreateInviteRequestSchema,
  ListInvitesQuerySchema,
  UuidSchema,
} from '@locus/shared';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { DomainWriteError } from '../services/domainWriteError.js';
import type { Mailer } from '../services/mailer.js';
import { ForbiddenError } from '../services/permissions.js';
import {
  acceptInvite,
  createInvite,
  listInvitesForResource,
  revokeInvite,
} from '../services/invites.js';

type InviteEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

export function createInvitesRoutes(handle: DbHandle, mailer: Mailer) {
  const app = new Hono<InviteEnv>();

  app.use('/invites/*', async (c, next) => {
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

  app.use('/invites', async (c, next) => {
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

  app.get('/invites', async (c) => {
    const query = ListInvitesQuerySchema.safeParse({
      resource_type: c.req.query('resource_type'),
      resource_id: c.req.query('resource_id'),
    });
    if (!query.success) {
      return c.json({ error: 'VALIDATION_FAILED', message: query.error.message }, 422);
    }
    try {
      const invites = await listInvitesForResource(
        handle.db,
        { kind: 'user', userId: c.get('userId') },
        query.data.resource_type,
        query.data.resource_id,
      );
      return c.json({ invites });
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.post('/invites', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateInviteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_FAILED', message: parsed.error.message }, 422);
    }
    try {
      const result = await createInvite(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        mailer,
        parsed.data,
      );
      return c.json(result, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.post('/invites/accept', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AcceptInviteRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'VALIDATION_FAILED', message: parsed.error.message }, 422);
    }
    try {
      const result = await acceptInvite(
        handle,
        {
          principal: { kind: 'user', userId: c.get('userId') },
          deviceId: c.get('deviceId'),
        },
        parsed.data,
      );
      return c.json(result, 201);
    } catch (err) {
      return writeError(c, err);
    }
  });

  app.delete('/invites/:id', async (c) => {
    const id = parseId(c.req.param('id'));
    if (!id) return c.json({ error: 'VALIDATION_FAILED', message: 'invalid id' }, 422);
    try {
      await revokeInvite(handle.db, { kind: 'user', userId: c.get('userId') }, id);
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
