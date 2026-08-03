import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { changeLog, places, shares, users } from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const DEVICE_OTHER = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PHOTO = 'f0f0f0f0-f0f0-40f0-80f0-f0f0f0f0f0f0';
const PHOTO_SPOOF = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1';
const SHARE_VIEW = '10101010-1010-4101-8101-101010101010';
const NOW = new Date().toISOString();

function headers(userId: string, deviceId = DEVICE) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': deviceId,
  };
}

function photoBody(overrides: Record<string, unknown> = {}) {
  return {
    id: PHOTO,
    owner_id: OWNER,
    target_type: 'place',
    target_id: PLACE,
    content_type: 'image/jpeg',
    upload_state: 'local_only',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

describe('photos domain + metadata sync + ACL (Testcontainers)', () => {
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
      {
        id: VIEWER,
        email: 'viewer@example.com',
        displayName: 'Viewer',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
    await fx.handle.db.insert(places).values({
      id: PLACE,
      ownerId: OWNER,
      title: 'Photo place',
      visibility: 'private',
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: OWNER,
    });
    await fx.handle.db.insert(shares).values({
      id: SHARE_VIEW,
      resourceType: 'place',
      resourceId: PLACE,
      granteeUserId: VIEWER,
      permission: 'view',
      createdBy: OWNER,
      createdAt: NOW,
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('owner can create photo metadata; ChangeLog entity_type is photos', async () => {
    const created = await app.request('/photos', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(photoBody()),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { upload_state: string; storage_key?: string };
    expect(body.upload_state).toBe('local_only');
    expect(body.storage_key).toBeUndefined();

    const log = await fx.handle.db.select().from(changeLog);
    expect(log.some((r) => r.entityType === 'photos' && r.entityId === PHOTO)).toBe(
      true,
    );
  });

  it('rejects photo owned as someone else', async () => {
    const res = await app.request('/photos', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify(photoBody({ id: PHOTO_SPOOF, owner_id: OTHER })),
    });
    expect(res.status).toBe(403);
  });

  it('stranger without share cannot create or view photo metadata', async () => {
    const create = await app.request('/photos', {
      method: 'POST',
      headers: headers(OTHER),
      body: JSON.stringify(
        photoBody({
          id: 'f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2',
          owner_id: OTHER,
        }),
      ),
    });
    expect(create.status).toBe(403);

    const view = await app.request(`/photos/${PHOTO}`, {
      headers: headers(OTHER),
    });
    expect(view.status).toBe(403);
  });

  it('share view on target can view photo metadata but not create', async () => {
    const view = await app.request(`/photos/${PHOTO}`, {
      headers: headers(VIEWER),
    });
    expect(view.status).toBe(200);

    const create = await app.request('/photos', {
      method: 'POST',
      headers: headers(VIEWER),
      body: JSON.stringify(
        photoBody({
          id: 'f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3',
          owner_id: VIEWER,
        }),
      ),
    });
    expect(create.status).toBe(403);
  });

  it('enforces upload_state transitions on update', async () => {
    const skip = await app.request(`/photos/${PHOTO}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify(photoBody({ upload_state: 'uploaded' })),
    });
    expect(skip.status).toBe(422);

    const pending = await app.request(`/photos/${PHOTO}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify(photoBody({ upload_state: 'pending' })),
    });
    expect(pending.status).toBe(200);

    const uploaded = await app.request(`/photos/${PHOTO}`, {
      method: 'PUT',
      headers: headers(OWNER),
      body: JSON.stringify(photoBody({ upload_state: 'uploaded', sha256: 'abc' })),
    });
    expect(uploaded.status).toBe(200);
    const body = (await uploaded.json()) as { upload_state: string };
    expect(body.upload_state).toBe('uploaded');
  });

  it('pull includes photos for entitled users and omits for strangers', async () => {
    const ownerPull = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE_OTHER}&schema_version=1`,
      { headers: headers(OWNER, DEVICE_OTHER) },
    );
    expect(ownerPull.status).toBe(200);
    const ownerBag = (await ownerPull.json()) as {
      changes: { photos: { created: Array<{ id: string }>; updated: unknown[] } };
    };
    const ownerIds = [
      ...ownerBag.changes.photos.created.map((r) => r.id),
      ...(ownerBag.changes.photos.updated as Array<{ id: string }>).map((r) => r.id),
    ];
    expect(ownerIds).toContain(PHOTO);

    const strangerPull = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE_OTHER}&schema_version=1`,
      { headers: headers(OTHER, DEVICE_OTHER) },
    );
    expect(strangerPull.status).toBe(200);
    const strangerBag = (await strangerPull.json()) as {
      changes: { photos: { created: Array<{ id: string }>; updated: unknown[] } };
    };
    const strangerIds = [
      ...strangerBag.changes.photos.created.map((r) => r.id),
      ...(strangerBag.changes.photos.updated as Array<{ id: string }>).map(
        (r) => r.id,
      ),
    ];
    expect(strangerIds).not.toContain(PHOTO);

    const viewerPull = await app.request(
      `/sync/pull?cursor=0&device_id=${DEVICE_OTHER}&schema_version=1`,
      { headers: headers(VIEWER, DEVICE_OTHER) },
    );
    expect(viewerPull.status).toBe(200);
    const viewerBag = (await viewerPull.json()) as {
      changes: { photos: { created: Array<{ id: string }>; updated: unknown[] } };
    };
    const viewerIds = [
      ...viewerBag.changes.photos.created.map((r) => r.id),
      ...(viewerBag.changes.photos.updated as Array<{ id: string }>).map((r) => r.id),
    ];
    expect(viewerIds).toContain(PHOTO);
  });

  it('owner can soft-delete; stranger cannot', async () => {
    const forbidden = await app.request(`/photos/${PHOTO}`, {
      method: 'DELETE',
      headers: headers(OTHER),
    });
    expect(forbidden.status).toBe(403);

    const ok = await app.request(`/photos/${PHOTO}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(ok.status).toBe(204);

    const gone = await app.request(`/photos/${PHOTO}`, {
      headers: headers(OWNER),
    });
    expect(gone.status).toBe(404);
  });
});
