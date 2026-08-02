import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { users } from '../src/db/schema.js';
import { getReadableWatermark } from '../src/services/changeLog.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GRANTEE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE_A = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const DEVICE_B = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SHARE = '13131313-1313-4131-8131-131313131313';
const PUSH_1 = '11111111-1111-4111-8111-111111111111';
const NOW = new Date().toISOString();

function placePayload(id: string, ownerId: string) {
  return {
    id,
    owner_id: ownerId,
    title: 'Synced place',
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

describe('sync pull/push (Testcontainers)', () => {
  let fx: PgFixture;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fx = await startPostgresFixture();
    app = createApp(fx.handle);
    await fx.handle.db.insert(users).values([
      {
        id: OWNER,
        email: 'owner@example.com',
        displayName: 'Owner',
        passwordHash: 'x',
        createdAt: NOW,
      },
      {
        id: GRANTEE,
        email: 'grantee@example.com',
        displayName: 'Grantee',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  async function push(
    userId: string,
    deviceId: string,
    body: Record<string, unknown>,
  ) {
    return app.request('/sync/push', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-locus-user-id': userId,
        'x-locus-device-id': deviceId,
      },
      body: JSON.stringify(body),
    });
  }

  async function pull(userId: string, deviceId: string, cursor: number) {
    return app.request(
      `/sync/pull?cursor=${cursor}&device_id=${deviceId}&schema_version=1`,
      {
        headers: {
          'x-locus-user-id': userId,
          'x-locus-device-id': deviceId,
        },
      },
    );
  }

  it('push applies a place and advances the watermark', async () => {
    const res = await push(OWNER, DEVICE_A, {
      push_id: PUSH_1,
      cursor: 0,
      device_id: DEVICE_A,
      changes: {
        places: {
          created: [placePayload(PLACE, OWNER)],
          updated: [],
          deleted: [],
        },
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: number; timestamp: number };
    expect(body.applied).toBe(1);
    expect(body.timestamp).toBeGreaterThan(0);
    expect(await getReadableWatermark(fx.handle.db)).toBe(body.timestamp);
  });

  it('replays the same push_id verbatim (idempotent)', async () => {
    const res = await push(OWNER, DEVICE_A, {
      push_id: PUSH_1,
      cursor: 0,
      device_id: DEVICE_A,
      changes: {
        places: {
          created: [placePayload(PLACE, OWNER)],
          updated: [],
          deleted: [],
        },
      },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: number };
    expect(body.applied).toBe(1);
  });

  it('stale cursor on push returns 409 PULL_REQUIRED', async () => {
    const res = await push(OWNER, DEVICE_B, {
      push_id: '22222222-2222-4222-8222-222222222222',
      cursor: 0,
      device_id: DEVICE_B,
      changes: {
        places: {
          created: [placePayload('f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0', OWNER)],
          updated: [],
          deleted: [],
        },
      },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PULL_REQUIRED');
  });

  it('pull echo-suppresses the pushing device and delivers to another', async () => {
    const self = await pull(OWNER, DEVICE_A, 0);
    expect(self.status).toBe(200);
    const selfBody = (await self.json()) as {
      changes: { places: { created: unknown[] } };
      timestamp: number;
    };
    expect(selfBody.changes.places.created).toHaveLength(0);

    const other = await pull(OWNER, DEVICE_B, 0);
    const otherBody = (await other.json()) as {
      changes: { places: { created: Array<{ id: string }> } };
    };
    expect(otherBody.changes.places.created.some((p) => p.id === PLACE)).toBe(true);
  });

  it('unsupported schema_version returns 426', async () => {
    const res = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE_A}&schema_version=99`,
      {
        headers: {
          'x-locus-user-id': OWNER,
          'x-locus-device-id': DEVICE_A,
        },
      },
    );
    expect(res.status).toBe(426);
  });

  it('late grant injects the place on the next pull regardless of cursor', async () => {
    const watermark = await getReadableWatermark(fx.handle.db);
    const sharePush = await push(OWNER, DEVICE_A, {
      push_id: '33333333-3333-4333-8333-333333333333',
      cursor: watermark,
      device_id: DEVICE_A,
      changes: {
        shares: {
          created: [
            {
              id: SHARE,
              resource_type: 'place',
              resource_id: PLACE,
              grantee_user_id: GRANTEE,
              permission: 'view',
              created_by: OWNER,
              created_at: NOW,
            },
          ],
          updated: [],
          deleted: [],
        },
      },
    });
    expect(sharePush.status).toBe(200);

    // Grantee pulls with cursor past the place's original seq — late grant still injects.
    const granteePull = await pull(GRANTEE, DEVICE_B, watermark);
    expect(granteePull.status).toBe(200);
    const body = (await granteePull.json()) as {
      changes: { places: { created: Array<{ id: string }> } };
    };
    expect(body.changes.places.created.some((p) => p.id === PLACE)).toBe(true);
  });
});
