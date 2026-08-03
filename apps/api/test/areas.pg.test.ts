import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';

import { createApp } from '../src/index.js';
import { areas, changeLog, places, points, users } from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const AREA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PLACE_IN_AREA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const POINT_IN_PLACE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const POINT_DIRECT = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1';
const AREA_PUSH = '11111111-1111-4111-8111-111111111111';
const NOW = new Date().toISOString();

const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
};

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

function areaBody(
  id: string,
  ownerId: string,
  title = 'Rest area',
  opts: { bbox_min_lat?: number } = {},
) {
  return {
    id,
    owner_id: ownerId,
    title,
    geom_geojson: SQUARE,
    // Deliberately wrong but in-range bbox — server must derive from geom (DESIGN §4).
    bbox_min_lat: opts.bbox_min_lat ?? -50,
    bbox_min_lon: -50,
    bbox_max_lat: -40,
    bbox_max_lon: -40,
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

function placeBody(id: string, ownerId: string, areaId?: string, title = 'Nest place') {
  return {
    id,
    owner_id: ownerId,
    area_id: areaId,
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
    title: 'Nest point',
    lat: 0.5,
    lon: 0.5,
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

describe('areas domain + sync apply (Testcontainers)', () => {
  let fx: PgFixture;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fx = await startPostgresFixture();
    app = createApp(fx.handle);
    await fx.handle.db.insert(users).values([
      {
        id: OWNER,
        email: 'owner-area@example.com',
        displayName: 'Owner',
        passwordHash: 'x',
        createdAt: NOW,
      },
      {
        id: OTHER,
        email: 'other-area@example.com',
        displayName: 'Other',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('REST create/get/update derives bbox; soft-delete cascades owned children', async () => {
    const created = await app.request('/areas', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(areaBody(AREA, OWNER)),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as {
      id: string;
      bbox_min_lat: number;
      bbox_max_lon: number;
      geom_geojson: { type: string };
    };
    expect(createdBody.id).toBe(AREA);
    expect(createdBody.bbox_min_lat).toBe(0);
    expect(createdBody.bbox_max_lon).toBe(1);
    expect(createdBody.geom_geojson.type).toBe('Polygon');

    const [dbRow] = await fx.handle.db.select().from(areas).where(eq(areas.id, AREA));
    expect(dbRow?.bboxMinLat).toBe(0);
    expect(dbRow?.bboxMaxLon).toBe(1);

    const logAfterCreate = await fx.handle.db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.entityType, 'areas'), eq(changeLog.entityId, AREA)));
    expect(logAfterCreate.some((r) => r.op === 'create')).toBe(true);

    const nestPlace = await app.request('/places', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(placeBody(PLACE_IN_AREA, OWNER, AREA)),
    });
    expect(nestPlace.status).toBe(201);

    const nestPoint = await app.request('/points', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(pointBody(POINT_IN_PLACE, OWNER, { place_id: PLACE_IN_AREA })),
    });
    expect(nestPoint.status).toBe(201);

    const directPoint = await app.request('/points', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(pointBody(POINT_DIRECT, OWNER, { area_id: AREA })),
    });
    expect(directPoint.status).toBe(201);

    const forbidden = await app.request(`/areas/${AREA}`, {
      method: 'PUT',
      headers: headers(OTHER),
      body: JSON.stringify(areaBody(AREA, OWNER, 'Hijack')),
    });
    expect(forbidden.status).toBe(403);

    const deleted = await app.request(`/areas/${AREA}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(deleted.status).toBe(204);

    const [areaRow] = await fx.handle.db.select().from(areas).where(eq(areas.id, AREA));
    expect(areaRow?.deletedAt).toBeTruthy();

    const [placeRow] = await fx.handle.db
      .select()
      .from(places)
      .where(eq(places.id, PLACE_IN_AREA));
    expect(placeRow?.deletedAt).toBeTruthy();

    const [pointInPlace] = await fx.handle.db
      .select()
      .from(points)
      .where(eq(points.id, POINT_IN_PLACE));
    expect(pointInPlace?.deletedAt).toBeTruthy();

    const [direct] = await fx.handle.db
      .select()
      .from(points)
      .where(eq(points.id, POINT_DIRECT));
    expect(direct?.deletedAt).toBeTruthy();

    // One ChangeLog delete for the area — cascade payload, not N child ops.
    const deleteLogs = await fx.handle.db
      .select()
      .from(changeLog)
      .where(
        and(
          eq(changeLog.entityType, 'areas'),
          eq(changeLog.entityId, AREA),
          eq(changeLog.op, 'delete'),
        ),
      );
    expect(deleteLogs).toHaveLength(1);
    const cascade = deleteLogs[0]?.payload as {
      cascaded: { places: string[]; points: string[] };
    };
    expect(cascade.cascaded.places).toContain(PLACE_IN_AREA);
    expect(cascade.cascaded.points).toEqual(
      expect.arrayContaining([POINT_IN_PLACE, POINT_DIRECT]),
    );

    const missing = await app.request(`/areas/${AREA}`, { headers: headers(OWNER) });
    expect(missing.status).toBe(404);
  });

  it('sync push applies area and pull expands cascade soft-delete', async () => {
    const areaId = 'a2a2a2a2-a2a2-42a2-82a2-a2a2a2a2a2a2';
    const placeId = 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2';
    const pointId = 'c2c2c2c2-c2c2-42c2-82c2-c2c2c2c2c2c2';
    const otherDevice = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';

    const watermarkRes = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor } = (await watermarkRes.json()) as { timestamp: number };

    const areaPush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: AREA_PUSH,
        cursor,
        device_id: DEVICE,
        changes: {
          areas: {
            created: [areaBody(areaId, OWNER, 'Push area')],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(areaPush.status).toBe(200);
    expect(((await areaPush.json()) as { applied: number }).applied).toBe(1);

    const [pushed] = await fx.handle.db.select().from(areas).where(eq(areas.id, areaId));
    expect(pushed?.bboxMinLat).toBe(0);

    const afterArea = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor2 } = (await afterArea.json()) as { timestamp: number };

    const nestPush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: '22222222-2222-4222-8222-222222222222',
        cursor: cursor2,
        device_id: DEVICE,
        changes: {
          places: {
            created: [placeBody(placeId, OWNER, areaId)],
            updated: [],
            deleted: [],
          },
          points: {
            created: [pointBody(pointId, OWNER, { place_id: placeId })],
            updated: [],
            deleted: [],
          },
        },
      }),
    });
    expect(nestPush.status).toBe(200);

    const afterNest = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    const { timestamp: cursor3 } = (await afterNest.json()) as { timestamp: number };

    const deletePush = await app.request('/sync/push', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        push_id: '33333333-3333-4333-8333-333333333333',
        cursor: cursor3,
        device_id: DEVICE,
        changes: {
          areas: { created: [], updated: [], deleted: [areaId] },
        },
      }),
    });
    expect(deletePush.status).toBe(200);

    // Echo-suppressed for DEVICE; pull as another device to see cascade expansion.
    const pullOther = await app.request(
      `/sync/pull?cursor=${cursor3}&device_id=${otherDevice}&schema_version=1`,
      { headers: headers(OWNER) },
    );
    expect(pullOther.status).toBe(200);
    const pullBody = (await pullOther.json()) as {
      changes: {
        areas: { deleted: string[] };
        places: { deleted: string[] };
        points: { deleted: string[] };
      };
    };
    expect(pullBody.changes.areas.deleted).toContain(areaId);
    expect(pullBody.changes.places.deleted).toContain(placeId);
    expect(pullBody.changes.points.deleted).toContain(pointId);

    const [alivePlace] = await fx.handle.db
      .select()
      .from(places)
      .where(and(eq(places.id, placeId), isNull(places.deletedAt)));
    expect(alivePlace).toBeUndefined();
  });
});
