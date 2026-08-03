import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { areas, places, shares, users } from '../src/db/schema.js';
import type { InviteMail, Mailer } from '../src/services/mailer.js';
import { can } from '../src/services/permissions.js';
import { hashOpaqueToken } from '../src/services/tokenHash.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GRANTEE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DEVICE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const AREA = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PLACE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const NOW = new Date().toISOString();

describe('Shares + invites API (Testcontainers)', () => {
  let fx: PgFixture;
  const inviteCapture: { mail: InviteMail | undefined } = { mail: undefined };
  const mailer: Mailer = {
    async sendPasswordReset() {
      /* unused */
    },
    async sendInvite(mail) {
      inviteCapture.mail = mail;
    },
  };

  beforeAll(async () => {
    fx = await startPostgresFixture();
    const db = fx.handle.db;
    await db.insert(users).values([
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
      {
        id: STRANGER,
        email: 'stranger@example.com',
        displayName: 'Stranger',
        passwordHash: 'x',
        createdAt: NOW,
      },
    ]);
    await db.insert(areas).values({
      id: AREA,
      ownerId: OWNER,
      title: 'Area',
      geomGeojson: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
      bboxMinLat: 0,
      bboxMinLon: 0,
      bboxMaxLat: 1,
      bboxMaxLon: 1,
      visibility: 'private',
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: OWNER,
    });
    await db.insert(places).values({
      id: PLACE,
      ownerId: OWNER,
      areaId: AREA,
      title: 'Place',
      visibility: 'private',
      createdAt: NOW,
      updatedAt: NOW,
      updatedBy: OWNER,
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  function app() {
    return createApp(fx.handle, { mailer });
  }

  function authHeaders(userId: string): Record<string, string> {
    return {
      'content-type': 'application/json',
      'x-locus-user-id': userId,
      'x-locus-device-id': DEVICE,
    };
  }

  it('owner creates a share; grantee can view; stranger cannot manage', async () => {
    const createRes = await app().request('/shares', {
      method: 'POST',
      headers: authHeaders(OWNER),
      body: JSON.stringify({
        resource_type: 'area',
        resource_id: AREA,
        grantee_user_id: GRANTEE,
        permission: 'view',
      }),
    });
    expect(createRes.status).toBe(201);
    const share = (await createRes.json()) as { id: string; permission: string };
    expect(share.permission).toBe('view');

    expect(
      await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'view', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(true);

    const forbidden = await app().request('/shares', {
      method: 'POST',
      headers: authHeaders(STRANGER),
      body: JSON.stringify({
        resource_type: 'area',
        resource_id: AREA,
        grantee_user_id: STRANGER,
        permission: 'edit',
      }),
    });
    expect(forbidden.status).toBe(403);

    const list = await app().request(
      `/shares?resource_type=area&resource_id=${AREA}`,
      { headers: authHeaders(OWNER) },
    );
    expect(list.status).toBe(200);
    const listed = (await list.json()) as { shares: Array<{ id: string }> };
    expect(listed.shares.some((s) => s.id === share.id)).toBe(true);

    const revoke = await app().request(`/shares/${share.id}`, {
      method: 'DELETE',
      headers: authHeaders(OWNER),
    });
    expect(revoke.status).toBe(204);
    expect(
      await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'view', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(false);
  });

  it('invite for unknown email stores hashed token and accepts into a share', async () => {
    inviteCapture.mail = undefined;
    const createRes = await app().request('/invites', {
      method: 'POST',
      headers: authHeaders(OWNER),
      body: JSON.stringify({
        email: 'newbie@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'comment',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      kind: string;
      token?: string;
      invite?: { id: string; email: string };
    };
    expect(created.kind).toBe('invite');
    expect(created.token).toBeTruthy();
    expect(created.invite?.email).toBe('newbie@example.com');
    expect(inviteCapture.mail?.inviteToken).toBe(created.token);

    // Token is hashed — raw must not appear in invites table.
    const { invites } = await import('../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    const [row] = await fx.handle.db
      .select()
      .from(invites)
      .where(eq(invites.id, created.invite!.id))
      .limit(1);
    expect(row?.tokenHash).toBe(hashOpaqueToken(created.token!));
    expect(row?.tokenHash).not.toBe(created.token);

    // Register the invitee, then accept.
    const NEWBIE = '12121212-1212-4121-8121-121212121212';
    await fx.handle.db.insert(users).values({
      id: NEWBIE,
      email: 'newbie@example.com',
      displayName: 'Newbie',
      passwordHash: 'x',
      createdAt: NOW,
    });

    const accept = await app().request('/invites/accept', {
      method: 'POST',
      headers: authHeaders(NEWBIE),
      body: JSON.stringify({ token: created.token }),
    });
    expect(accept.status).toBe(201);
    const accepted = (await accept.json()) as {
      share: { grantee_user_id: string; permission: string };
    };
    expect(accepted.share.grantee_user_id).toBe(NEWBIE);
    expect(accepted.share.permission).toBe('comment');
    expect(
      await can(fx.handle.db, { kind: 'user', userId: NEWBIE }, 'comment', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(true);

    const leftover = await fx.handle.db
      .select()
      .from(invites)
      .where(eq(invites.id, created.invite!.id));
    expect(leftover).toHaveLength(0);
  });

  it('invite to an existing account creates a share instead', async () => {
    const createRes = await app().request('/invites', {
      method: 'POST',
      headers: authHeaders(OWNER),
      body: JSON.stringify({
        email: 'grantee@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'edit',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      kind: string;
      share?: { grantee_user_id: string; permission: string };
    };
    expect(created.kind).toBe('share');
    expect(created.share?.grantee_user_id).toBe(GRANTEE);
    expect(created.share?.permission).toBe('edit');
    expect(
      await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'edit', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(true);
  });

  it('non-owner cannot revoke a share', async () => {
    const [row] = await fx.handle.db.select().from(shares).limit(1);
    expect(row).toBeTruthy();
    const res = await app().request(`/shares/${row!.id}`, {
      method: 'DELETE',
      headers: authHeaders(STRANGER),
    });
    expect(res.status).toBe(403);
  });
});
