import {
  SyncErrorCodes,
  SyncErrorHttpStatus,
  SyncPullQuerySchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  type SyncErrorCode,
  type SyncPushResponse,
} from '@locus/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

function statusFor(code: SyncErrorCode): ContentfulStatusCode {
  return SyncErrorHttpStatus[code] as ContentfulStatusCode;
}

import type { DbHandle } from '../db/client.js';
import { syncPushReceipts } from '../db/schema.js';
import {
  getReadableWatermark,
  withChangeLogWriter,
} from '../services/changeLog.js';
import { syncApply } from '../services/syncApply.js';
import {
  SUPPORTED_SCHEMA_VERSION,
  syncPull,
} from '../services/syncPull.js';

type SyncEnv = {
  Variables: {
    db: DbHandle['db'];
    userId: string;
    deviceId: string;
  };
};

/**
 * Temporary principal injection until auth middleware lands.
 * Clients/tests send `X-Locus-User-Id` + `X-Locus-Device-Id`.
 */
export function createSyncRoutes(handle: DbHandle) {
  const app = new Hono<SyncEnv>();

  app.use('/sync/*', async (c, next) => {
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

  app.get('/sync/pull', async (c) => {
    const parsed = SyncPullQuerySchema.safeParse({
      cursor: c.req.query('cursor'),
      device_id: c.req.query('device_id') ?? c.get('deviceId'),
      schema_version: c.req.query('schema_version'),
    });
    if (!parsed.success) {
      return c.json(
        {
          code: SyncErrorCodes.VALIDATION_FAILED,
          message: parsed.error.message,
        },
        statusFor('VALIDATION_FAILED'),
      );
    }

    if (parsed.data.schema_version !== SUPPORTED_SCHEMA_VERSION) {
      return c.json(
        {
          code: SyncErrorCodes.SCHEMA_VERSION_UNSUPPORTED,
          message: `supported schema_version=${SUPPORTED_SCHEMA_VERSION}`,
        },
        statusFor('SCHEMA_VERSION_UNSUPPORTED'),
      );
    }

    const result = await syncPull(handle.db, {
      cursor: parsed.data.cursor,
      deviceId: parsed.data.device_id,
      principal: { kind: 'user', userId: c.get('userId') },
    });

    return c.json(result);
  });

  app.post('/sync/push', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SyncPushRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          code: SyncErrorCodes.VALIDATION_FAILED,
          message: parsed.error.message,
        },
        statusFor('VALIDATION_FAILED'),
      );
    }

    const req = parsed.data;
    const userId = c.get('userId');

    const [existing] = await handle.db
      .select()
      .from(syncPushReceipts)
      .where(eq(syncPushReceipts.pushId, req.push_id))
      .limit(1);
    if (existing) {
      return c.json(existing.responseJson as SyncPushResponse);
    }

    const watermark = await getReadableWatermark(handle.db);
    if (req.cursor < watermark) {
      // Stale cursor ⇒ pull and rebase; never merge blind (DESIGN §5).
      return c.json(
        {
          code: SyncErrorCodes.PULL_REQUIRED,
          message: 'Pull and rebase before pushing',
        },
        statusFor('PULL_REQUIRED'),
      );
    }

    const response = await withChangeLogWriter(handle, async () => {
      const result = await syncApply(
        {
          db: handle.db,
          principal: { kind: 'user', userId },
          deviceId: req.device_id,
        },
        req.changes ?? {},
      );
      const timestamp = await getReadableWatermark(handle.db);
      const body: SyncPushResponse = {
        applied: result.applied,
        timestamp,
        rejected: result.rejected.map((r) => ({
          table: r.table,
          id: r.id,
          code: r.code,
          message: r.message,
        })),
      };
      SyncPushResponseSchema.parse(body);
      await handle.db.insert(syncPushReceipts).values({
        pushId: req.push_id,
        responseJson: body,
        createdAt: new Date().toISOString(),
      });
      return body;
    });

    return c.json(response);
  });

  return app;
}
