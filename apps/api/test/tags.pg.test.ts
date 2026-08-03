import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { places, users } from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const USER_TAG = 'c0c0c0c0-c0c0-40c0-80c0-c0c0c0c0c0c0';
const OTHER_TAG = 'c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1';
const TAGGING = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0';
const SYSTEM_MONUMENT = 'a1000000-0000-4000-8000-000000000001';
const NOW = new Date().toISOString();

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

describe('tags / taggings domain + ACL (Testcontainers)', () => {
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
    await fx.handle.db.insert(places).values({
      id: PLACE,
      ownerId: OWNER,
      title: 'Tagged place',
      visibility: 'private',
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: OWNER,
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('seeds system tags via migration', async () => {
    const res = await app.request('/tags', { headers: headers(OWNER) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tags: Array<{ id: string; scope: string }> };
    const system = body.tags.filter((t) => t.scope === 'system');
    expect(system.length).toBe(20);
    expect(system.some((t) => t.id === SYSTEM_MONUMENT)).toBe(true);
  });

  it('lets an authenticated user create a private tag; others cannot view it', async () => {
    const created = await app.request('/tags', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: USER_TAG,
        scope: 'user',
        owner_id: OWNER,
        label: 'secret-spot',
        colour: '#112233',
      }),
    });
    expect(created.status).toBe(201);

    const ownerGet = await app.request(`/tags/${USER_TAG}`, {
      headers: headers(OWNER),
    });
    expect(ownerGet.status).toBe(200);

    const otherGet = await app.request(`/tags/${USER_TAG}`, {
      headers: headers(OTHER),
    });
    expect(otherGet.status).toBe(403);

    const otherList = await app.request('/tags', { headers: headers(OTHER) });
    const otherBody = (await otherList.json()) as {
      tags: Array<{ id: string }>;
    };
    expect(otherBody.tags.some((t) => t.id === USER_TAG)).toBe(false);
  });

  it('rejects assigning another user private tag; allows system + own', async () => {
    await app.request('/tags', {
      method: 'POST',
      headers: headers(OTHER),
      body: JSON.stringify({
        id: OTHER_TAG,
        scope: 'user',
        owner_id: OTHER,
        label: 'other-only',
        colour: '#abcdef',
      }),
    });

    const steal = await app.request('/taggings', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1',
        tag_id: OTHER_TAG,
        target_type: 'place',
        target_id: PLACE,
        created_at: NOW,
      }),
    });
    expect(steal.status).toBe(403);

    const own = await app.request('/taggings', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: TAGGING,
        tag_id: USER_TAG,
        target_type: 'place',
        target_id: PLACE,
        created_at: NOW,
      }),
    });
    expect(own.status).toBe(201);
    const ownBody = (await own.json()) as { tag_label: string; tag_scope: string };
    expect(ownBody.tag_label).toBe('secret-spot');
    expect(ownBody.tag_scope).toBe('user');

    const systemAssign = await app.request('/taggings', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2',
        tag_id: SYSTEM_MONUMENT,
        target_type: 'place',
        target_id: PLACE,
        created_at: NOW,
      }),
    });
    expect(systemAssign.status).toBe(201);
  });

  it('soft-retires a tag and blocks new assigns; strip_from_all removes taggings', async () => {
    const retire = await app.request(`/tags/${USER_TAG}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(retire.status).toBe(204);

    const blocked = await app.request('/taggings', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: 'd3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3',
        tag_id: USER_TAG,
        target_type: 'place',
        target_id: PLACE,
        created_at: NOW,
      }),
    });
    expect(blocked.status).toBe(422);

    const stillThere = await app.request(
      `/taggings?target_type=place&target_id=${PLACE}`,
      { headers: headers(OWNER) },
    );
    const listed = (await stillThere.json()) as {
      taggings: Array<{ id: string; tag_id: string }>;
    };
    expect(listed.taggings.some((t) => t.id === TAGGING)).toBe(true);

    const strip = await app.request(`/tags/${USER_TAG}?strip_from_all=true`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(strip.status).toBe(204);

    const after = await app.request(
      `/taggings?target_type=place&target_id=${PLACE}`,
      { headers: headers(OWNER) },
    );
    const afterBody = (await after.json()) as {
      taggings: Array<{ id: string }>;
    };
    expect(afterBody.taggings.some((t) => t.id === TAGGING)).toBe(false);
  });
});
