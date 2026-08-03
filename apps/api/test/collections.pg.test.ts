import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';

import { createApp } from '../src/index.js';
import {
  changeLog,
  collectionItems,
  collections,
  points,
  users,
} from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const COLLECTION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const POINT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ITEM = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = new Date().toISOString();

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

function collectionBody(id: string, ownerId: string, title = 'Trip') {
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

function pointBody(id: string, ownerId: string) {
  return {
    id,
    owner_id: ownerId,
    title: 'Member point',
    lat: 1,
    lon: 2,
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: ownerId,
  };
}

function itemBody(id: string, collectionId: string, itemId: string) {
  return {
    id,
    collection_id: collectionId,
    item_type: 'point' as const,
    item_id: itemId,
    added_at: NOW,
    updated_at: NOW,
  };
}

describe('collections domain + sync apply (Testcontainers)', () => {
  let fx: PgFixture;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fx = await startPostgresFixture();
    app = createApp(fx.handle);
    await fx.handle.db.insert(users).values([
      {
        id: OWNER,
        email: 'owner-coll@example.com',
        displayName: 'Owner',
        passwordHash: 'x',
        createdAt: NOW,
      },
      {
        id: OTHER,
        email: 'other-coll@example.com',
        displayName: 'Other',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('REST create/get/update; soft-delete cascades membership rows', async () => {
    const created = await app.request('/collections', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(collectionBody(COLLECTION, OWNER)),
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { id: string; title: string };
    expect(createdBody.id).toBe(COLLECTION);
    expect(createdBody.title).toBe('Trip');

    const pointRes = await app.request('/points', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(pointBody(POINT, OWNER)),
    });
    expect(pointRes.status).toBe(201);

    const itemRes = await app.request('/collection-items', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(itemBody(ITEM, COLLECTION, POINT)),
    });
    expect(itemRes.status).toBe(201);

    const [itemRow] = await fx.handle.db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.id, ITEM));
    expect(itemRow?.collectionId).toBe(COLLECTION);
    expect(itemRow?.deletedAt).toBeNull();

    const forbidden = await app.request('/collections/' + COLLECTION, {
      method: 'PUT',
      headers: headers(OTHER),
      body: JSON.stringify(collectionBody(COLLECTION, OWNER, 'Hijack')),
    });
    expect(forbidden.status).toBe(403);

    const updated = await app.request('/collections/' + COLLECTION, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify(collectionBody(COLLECTION, OWNER, 'Updated trip')),
    });
    expect(updated.status).toBe(200);
    const updatedBody = (await updated.json()) as { title: string };
    expect(updatedBody.title).toBe('Updated trip');

    const del = await app.request('/collections/' + COLLECTION, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(del.status).toBe(204);

    const [collRow] = await fx.handle.db
      .select()
      .from(collections)
      .where(eq(collections.id, COLLECTION));
    expect(collRow?.deletedAt).not.toBeNull();

    const [itemAfter] = await fx.handle.db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.id, ITEM));
    expect(itemAfter?.deletedAt).not.toBeNull();

    const deleteLog = await fx.handle.db
      .select()
      .from(changeLog)
      .where(
        and(eq(changeLog.entityType, 'collections'), eq(changeLog.entityId, COLLECTION)),
      );
    const cascadeEntry = deleteLog.find((r) => r.op === 'delete');
    expect(cascadeEntry?.payload).toMatchObject({
      cascaded: { collection_items: [ITEM] },
    });

    // Point itself is not cascade-deleted with the collection.
    const [pointRow] = await fx.handle.db
      .select()
      .from(points)
      .where(and(eq(points.id, POINT), isNull(points.deletedAt)));
    expect(pointRow).toBeTruthy();
  });

  it('rejects adding an item the actor cannot view', async () => {
    const collId = '11111111-1111-4111-8111-111111111111';
    const otherPoint = '22222222-2222-4222-8222-222222222222';
    const itemId = '33333333-3333-4333-8333-333333333333';

    const coll = await app.request('/collections', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(collectionBody(collId, OWNER, 'Mine')),
    });
    expect(coll.status).toBe(201);

    const point = await app.request('/points', {
      method: 'POST',
      headers: headers(OTHER),
      body: JSON.stringify(pointBody(otherPoint, OTHER)),
    });
    expect(point.status).toBe(201);

    const denied = await app.request('/collection-items', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(itemBody(itemId, collId, otherPoint)),
    });
    expect(denied.status).toBe(403);
  });
});
