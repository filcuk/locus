import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { changeLog, places, users } from '../src/db/schema.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOTE = 'a0a0a0a0-a0a0-40a0-80a0-a0a0a0a0a0a0';
const NOTE_OTHER = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1';
const COMMENT = 'b0b0b0b0-b0b0-40b0-80b0-b0b0b0b0b0b0';
const NOW = new Date().toISOString();

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

describe('notes/comments domain + ACL (Testcontainers)', () => {
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
      title: 'Shared place',
      visibility: 'private',
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: OWNER,
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  it('owner can create a visit note; other cannot read it', async () => {
    const created = await app.request('/notes', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: NOTE,
        author_id: OWNER,
        target_type: 'place',
        target_id: PLACE,
        visited_at: NOW,
        created_at: NOW,
        updated_at: NOW,
      }),
    });
    expect(created.status).toBe(201);

    const ownerGet = await app.request(`/notes/${NOTE}`, {
      headers: headers(OWNER),
    });
    expect(ownerGet.status).toBe(200);

    const otherGet = await app.request(`/notes/${NOTE}`, {
      headers: headers(OTHER),
    });
    expect(otherGet.status).toBe(403);

    const log = await fx.handle.db.select().from(changeLog);
    expect(log.some((r) => r.entityType === 'notes' && r.entityId === NOTE)).toBe(
      true,
    );
  });

  it('rejects note authored as someone else', async () => {
    const res = await app.request('/notes', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: NOTE_OTHER,
        author_id: OTHER,
        target_type: 'place',
        target_id: PLACE,
        body: 'spoof',
        created_at: NOW,
        updated_at: NOW,
      }),
    });
    expect(res.status).toBe(403);
  });

  it('owner can comment; stranger without share cannot', async () => {
    const ok = await app.request('/comments', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: COMMENT,
        author_id: OWNER,
        target_type: 'place',
        target_id: PLACE,
        body: 'Hello',
        created_at: NOW,
        updated_at: NOW,
      }),
    });
    expect(ok.status).toBe(201);

    const forbidden = await app.request('/comments', {
      method: 'POST',
      headers: headers(OTHER),
      body: JSON.stringify({
        id: 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1',
        author_id: OTHER,
        target_type: 'place',
        target_id: PLACE,
        body: 'Nope',
        created_at: NOW,
        updated_at: NOW,
      }),
    });
    expect(forbidden.status).toBe(403);

    const strangerView = await app.request(`/comments/${COMMENT}`, {
      headers: headers(OTHER),
    });
    expect(strangerView.status).toBe(403);
  });
});
