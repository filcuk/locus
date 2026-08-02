import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';

import { createApp } from '../src/index.js';
import { changeLog, places, points, users } from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const POINT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const POINT_BAD = 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0';
const AREA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PUSH_PLACE = '11111111-1111-4111-8111-111111111111';
const PUSH_POINT = '22222222-2222-4222-8222-222222222222';
const PUSH_FORBIDDEN = '33333333-3333-4333-8333-333333333333';
const PUSH_XOR = '44444444-4444-4444-8444-444444444444';
const NOW = new Date().toISOString();

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

function placeBody(id: string, ownerId: string, title = 'Rest place') {
  return {
    id,
    owner_id: ownerId,
    title,
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

function pointBody(
  id: string,
  ownerId: string,
  opts: { place_id?: string; area_id?: string } = {},
) {
  return {
    id,
    owner_id: ownerId,
    place_id: opts.place_id,
    area_id: opts.area_id,
    title: 'Rest point',
    lat: 51.5,
    lon: -0.12,
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

describe('places/points domain + sync apply (Testcontainers)', () => {
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
        id: OTHER,
        email: 'other@example.com',
        displayName: 'Other',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('REST create/get/update/soft-delete place via syncApply + ChangeLog', async () => {
    const created = await app.request('/places', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(placeBody(PLACE, OWNER)),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { id: string; title: string; owner_id: string };
    expect(createdBody.id).toBe(PLACE);
    expect(createdBody.owner_id).toBe(OWNER);

    const logAfterCreate = await fx.handle.db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.entityType, 'places'), eq(changeLog.entityId, PLACE)));
    expect(logAfterCreate.some((r) => r.op === 'create')).toBe(true);

    const got = await app.request(`/places/${PLACE}`, { headers: headers(OWNER) });
    expect(got.status).toBe(200);

    const updated = await app.request(`/places/${PLACE}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify(placeBody(PLACE, OWNER, 'Updated place')),
    });
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as { title: string }).title).toBe('Updated place');

    const deleted = await app.request(`/places/${PLACE}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(deleted.status).toBe(204);

    const [row] = await fx.handle.db.select().from(places).where(eq(places.id, PLACE));
    expect(row?.deletedAt).toBeTruthy();

    const missing = await app.request(`/places/${PLACE}`, { headers: headers(OWNER) });
    expect(missing.status).toBe(404);

    // Recreate for later point nesting tests (new id path uses a fresh place below).
  });

  it('REST create point under a place; push XOR rejection; forbidden path', async () => {
    const placeId = 'e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1';
    const createPlace = await app.request('/places', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(placeBody(placeId, OWNER, 'Parent place')),
    });
    expect(createPlace.status).toBe(201);

    const createPoint = await app.request('/points', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(pointBody(POINT, OWNER, { place_id: placeId })),
    });
    expect(createPoint.status).toBe(201);

    const [pointRow] = await fx.handle.db
      .select()
      .from(points)
      .where(and(eq(points.id, POINT), isNull(points.deletedAt)));
    expect(pointRow?.placeId).toBe(placeId);
    expect(pointRow?.areaId).toBeNull();

    const xor = await app.request('/points', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(
        pointBody(POINT_BAD, OWNER, { place_id: placeId, area_id: AREA }),
      ),
    });
    expect(xor.status).toBe(422);
    const xorBody = (await xor.json()) as { error: string };
    expect(xorBody.error).toBe('VALIDATION_FAILED');

    const forbidden = await app.request(`/points/${POINT}`, {
      method: 'PUT',
      headers: headers(OTHER),
      body: JSON.stringify(pointBody(POINT, OWNER, { place_id: placeId })),
    });
    expect(forbidden.status).toBe(403);
  });

  it('sync push applies place/point, rejects forbidden update, rejects dual parent', async () => {
    const placeId = 'e2e2e2e2-e2e2-42e2-82e2-e2e2e2e2e2e2';
    const pointId = 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2';

    const watermarkRes = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor } = (await watermarkRes.json()) as { timestamp: number };

    const placePush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: PUSH_PLACE,
        cursor,
        device_id: DEVICE,
        changes: {
          places: {
            created: [placeBody(placeId, OWNER, 'Push place')],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(placePush.status).toBe(200);
    expect(((await placePush.json()) as { applied: number }).applied).toBe(1);

    const afterPlace = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor2 } = (await afterPlace.json()) as { timestamp: number };

    const pointPush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: PUSH_POINT,
        cursor: cursor2,
        device_id: DEVICE,
        changes: {
          points: {
            created: [pointBody(pointId, OWNER, { place_id: placeId })],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(pointPush.status).toBe(200);
    expect(((await pointPush.json()) as { applied: number }).applied).toBe(1);

    const afterPoint = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor3 } = (await afterPoint.json()) as { timestamp: number };

    const forbiddenPush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OTHER),
      body: JSON.stringify({
        push_id: PUSH_FORBIDDEN,
        cursor: cursor3,
        device_id: DEVICE,
        changes: {
          points: {
            created: [],
            updated: [pointBody(pointId, OWNER, { place_id: placeId })],
            deleted: [],
          },
        },
      }),
    });
    expect(forbiddenPush.status).toBe(200);
    const forbiddenBody = (await forbiddenPush.json()) as {
      applied: number;
      rejected: Array<{ code: string; table: string }>;
    };
    expect(forbiddenBody.applied).toBe(0);
    expect(forbiddenBody.rejected[0]?.code).toBe('FORBIDDEN');
    expect(forbiddenBody.rejected[0]?.table).toBe('points');

    // OTHER's successful (empty) push advanced receipts but not watermark if nothing applied.
    // Re-read watermark for the XOR attempt as OWNER.
    const wm = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor4 } = (await wm.json()) as { timestamp: number };

    // Dual parent fails the shared PointSchema on the wire (422), before apply.
    const xorPush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: PUSH_XOR,
        cursor: cursor4,
        device_id: DEVICE,
        changes: {
          points: {
            created: [
              pointBody('f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3', OWNER, {
                place_id: placeId,
                area_id: AREA,
              }),
            ],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(xorPush.status).toBe(422);
    const xorBody = (await xorPush.json()) as { code: string };
    expect(xorBody.code).toBe('VALIDATION_FAILED');
  });

  it('replays push_id verbatim (idempotent apply receipt)', async () => {
    const res = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: PUSH_PLACE,
        cursor: 0,
        device_id: DEVICE,
        changes: {
          places: {
            created: [placeBody('deadbeef-dead-4bee-8f00-deadbeefdead', OWNER)],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { applied: number };
    // Same push_id as earlier place push — stored response, not a second create.
    expect(body.applied).toBe(1);
  });
});
