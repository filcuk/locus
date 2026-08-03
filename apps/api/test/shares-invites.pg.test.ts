import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { createApp } from '../src/index.js';
import { changeLog, invites, places, shares, users } from '../src/db/schema.js';
import type { InviteMail, Mailer } from '../src/services/mailer.js';
import { can } from '../src/services/permissions.js';
import { hashOpaqueToken } from '../src/services/tokenHash.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GRANTEE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const SHARE = '13131313-1313-4131-8131-131313131313';
const INVITE = '14141414-1414-4141-8141-141414141414';
const NOW = new Date().toISOString();

function headers(userId: string) {
  return {
    'content-type': 'application/json',
    'x-locus-user-id': userId,
    'x-locus-device-id': DEVICE,
  };
}

describe('shares + invites API (Testcontainers)', () => {
  let fx: PgFixture;
  let lastInviteMail: InviteMail | undefined;
  const mailer: Mailer = {
    async sendPasswordReset() {
      /* unused */
    },
    async sendInvite(mail) {
      lastInviteMail = mail;
    },
  };

  beforeAll(async () => {
    fx = await startPostgresFixture();
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
      {
        id: STRANGER,
        email: 'stranger@example.com',
        displayName: 'Stranger',
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

  function app() {
    return createApp(fx.handle, { mailer });
  }

  it('owner creates and lists a share; grantee gains view via can()', async () => {
    const created = await app().request('/shares', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: SHARE,
        resource_type: 'place',
        resource_id: PLACE,
        grantee_user_id: GRANTEE,
        permission: 'view',
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { id: string; grantee_user_id: string };
    expect(body.id).toBe(SHARE);
    expect(body.grantee_user_id).toBe(GRANTEE);

    const listed = await app().request(
      `/shares?resource_type=place&resource_id=${PLACE}`,
      { headers: headers(OWNER) },
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { shares: Array<{ id: string }> };
    expect(listBody.shares.some((s) => s.id === SHARE)).toBe(true);

    const allowed = await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'view', {
      type: 'place',
      id: PLACE,
    });
    expect(allowed).toBe(true);

    const log = await fx.handle.db
      .select()
      .from(changeLog)
      .where(eq(changeLog.entityId, SHARE));
    expect(log.some((row) => row.entityType === 'shares' && row.op === 'create')).toBe(true);
  });

  it('non-owner cannot manage shares', async () => {
    const denied = await app().request('/shares', {
      method: 'POST',
      headers: headers(STRANGER),
      body: JSON.stringify({
        resource_type: 'place',
        resource_id: PLACE,
        grantee_user_id: STRANGER,
        permission: 'view',
      }),
    });
    expect(denied.status).toBe(403);

    const listDenied = await app().request(
      `/shares?resource_type=place&resource_id=${PLACE}`,
      { headers: headers(GRANTEE) },
    );
    expect(listDenied.status).toBe(403);
  });

  it('owner revokes a share', async () => {
    const revoked = await app().request(`/shares/${SHARE}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(revoked.status).toBe(204);

    const allowed = await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'view', {
      type: 'place',
      id: PLACE,
    });
    expect(allowed).toBe(false);
  });

  it('invite for unknown email stores hashed token and captures mail without logging token', async () => {
    lastInviteMail = undefined;
    const created = await app().request('/invites', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        id: INVITE,
        email: 'new.friend@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'comment',
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      kind: string;
      token: string;
      invite: { id: string; email: string };
    };
    expect(body.kind).toBe('invite');
    expect(body.invite.id).toBe(INVITE);
    expect(body.token.length).toBeGreaterThan(10);
    expect(lastInviteMail).toBeDefined();
    expect(lastInviteMail!.to).toBe('new.friend@example.com');
    expect(lastInviteMail!.inviteToken).toBe(body.token);

    const [row] = await fx.handle.db.select().from(invites).where(eq(invites.id, INVITE));
    expect(row).toBeDefined();
    expect(row!.tokenHash).toBe(hashOpaqueToken(body.token));
    expect(row!.tokenHash).not.toBe(body.token);
    expect(JSON.stringify(body)).not.toContain(row!.tokenHash);
  });

  it('invite for existing email mints a share instead', async () => {
    const created = await app().request('/invites', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        email: 'Grantee@Example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'edit',
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as {
      kind: string;
      share: { grantee_user_id: string; permission: string };
    };
    expect(body.kind).toBe('share');
    expect(body.share.grantee_user_id).toBe(GRANTEE);
    expect(body.share.permission).toBe('edit');

    const allowed = await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'edit', {
      type: 'place',
      id: PLACE,
    });
    expect(allowed).toBe(true);

    // Clean share so accept path can grant again below.
    await fx.handle.db.delete(shares).where(eq(shares.granteeUserId, GRANTEE));
  });

  it('accept invite creates share when email matches; wrong email is forbidden', async () => {
    lastInviteMail = undefined;
    const created = await app().request('/invites', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        email: 'grantee@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'view',
      }),
    });
    // grantee already has an account → share path, so create a fresh unknown invite:
    expect(created.status).toBe(201);
    const existingPath = (await created.json()) as { kind: string };
    expect(existingPath.kind).toBe('share');
    await fx.handle.db.delete(shares).where(eq(shares.granteeUserId, GRANTEE));

    const pending = await app().request('/invites', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        email: 'pending@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'view',
      }),
    });
    expect(pending.status).toBe(201);
    const pendingBody = (await pending.json()) as { kind: string; token: string; invite: { id: string } };
    expect(pendingBody.kind).toBe('invite');
    const raw = pendingBody.token;

    // Register the pending user by inserting (auth register would work; keep fixture light).
    const pendingUser = '15151515-1515-4151-8151-151515151515';
    await fx.handle.db.insert(users).values({
      id: pendingUser,
      email: 'pending@example.com',
      displayName: 'Pending',
      passwordHash: 'x',
      createdAt: NOW,
    });

    const wrong = await app().request('/invites/accept', {
      method: 'POST',
      headers: headers(STRANGER),
      body: JSON.stringify({ token: raw }),
    });
    expect(wrong.status).toBe(403);

    const accepted = await app().request('/invites/accept', {
      method: 'POST',
      headers: headers(pendingUser),
      body: JSON.stringify({ token: raw }),
    });
    expect(accepted.status).toBe(201);
    const acceptedBody = (await accepted.json()) as {
      share: { grantee_user_id: string; permission: string };
    };
    expect(acceptedBody.share.grantee_user_id).toBe(pendingUser);
    expect(acceptedBody.share.permission).toBe('view');

    const [gone] = await fx.handle.db
      .select()
      .from(invites)
      .where(eq(invites.id, pendingBody.invite.id));
    expect(gone).toBeUndefined();

    const allowed = await can(fx.handle.db, { kind: 'user', userId: pendingUser }, 'view', {
      type: 'place',
      id: PLACE,
    });
    expect(allowed).toBe(true);
  });

  it('owner can revoke a pending invite', async () => {
    const created = await app().request('/invites', {
      method: 'POST',
      headers: headers(OWNER),
      body: JSON.stringify({
        email: 'revoke.me@example.com',
        resource_type: 'place',
        resource_id: PLACE,
        permission: 'view',
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as { invite: { id: string } };

    const revoked = await app().request(`/invites/${body.invite.id}`, {
      method: 'DELETE',
      headers: headers(OWNER),
    });
    expect(revoked.status).toBe(204);

    const [gone] = await fx.handle.db.select().from(invites).where(eq(invites.id, body.invite.id));
    expect(gone).toBeUndefined();
  });
});
