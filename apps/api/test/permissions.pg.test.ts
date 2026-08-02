import { permissionMatrixRows, type Action, type PrincipalKind } from '@locus/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { areas, places, points, shares, users } from '../src/db/schema.js';
import { assertCan, can, ForbiddenError } from '../src/services/permissions.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GRANTEE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AREA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const POINT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PRIVATE_POINT = '12121212-1212-4121-8121-121212121212';
const NOW = new Date().toISOString();

describe('can() against Postgres (Testcontainers)', () => {
  let fx: PgFixture;

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
      visibility: 'unlisted',
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

    await db.insert(points).values([
      {
        id: POINT,
        ownerId: OWNER,
        placeId: PLACE,
        title: 'Point',
        lat: 0.5,
        lon: 0.5,
        visibility: 'unlisted',
        createdAt: NOW,
        updatedAt: NOW,
        updatedBy: OWNER,
      },
      {
        id: PRIVATE_POINT,
        ownerId: OWNER,
        placeId: PLACE,
        title: 'Private point',
        lat: 0.6,
        lon: 0.6,
        visibility: 'private',
        createdAt: NOW,
        updatedAt: NOW,
        updatedBy: OWNER,
      },
    ]);
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  async function ensureShare(permission: 'view' | 'comment' | 'edit'): Promise<void> {
    await fx.handle.db.delete(shares);
    await fx.handle.db.insert(shares).values({
      id: '13131313-1313-4131-8131-131313131313',
      resourceType: 'place',
      resourceId: PLACE,
      granteeUserId: GRANTEE,
      permission,
      createdBy: OWNER,
      createdAt: NOW,
    });
  }

  function principalFor(kind: PrincipalKind) {
    switch (kind) {
      case 'owner':
        return { kind: 'user' as const, userId: OWNER };
      case 'share_edit':
      case 'share_comment':
      case 'share_view':
        return { kind: 'user' as const, userId: GRANTEE };
      case 'public_link':
        return {
          kind: 'public_link' as const,
          resourceType: 'place' as const,
          resourceId: PLACE,
        };
      case 'authenticated_no_grant':
        return { kind: 'user' as const, userId: STRANGER };
      case 'anonymous_no_token':
        return { kind: 'anonymous' as const };
    }
  }

  async function preparePrincipal(kind: PrincipalKind): Promise<void> {
    await fx.handle.db.delete(shares);
    if (kind === 'share_edit') await ensureShare('edit');
    if (kind === 'share_comment') await ensureShare('comment');
    if (kind === 'share_view') await ensureShare('view');
  }

  describe('matrix over place resource', () => {
    for (const row of permissionMatrixRows()) {
      it(`${row.principal} / ${row.action} ⇒ ${row.allowed}`, async () => {
        await preparePrincipal(row.principal);
        const allowed = await can(
          fx.handle.db,
          principalFor(row.principal),
          row.action,
          { type: 'place', id: PLACE },
        );
        expect(allowed).toBe(row.allowed);
      });
    }
  });

  it('soft-deleted resources deny everyone including the owner', async () => {
    const { eq } = await import('drizzle-orm');
    await fx.handle.db.update(places).set({ deletedAt: NOW }).where(eq(places.id, PLACE));

    expect(
      await can(fx.handle.db, { kind: 'user', userId: OWNER }, 'view', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(false);

    await fx.handle.db.update(places).set({ deletedAt: null }).where(eq(places.id, PLACE));
  });

  it('share on area inherits to place and point', async () => {
    const { eq } = await import('drizzle-orm');
    await fx.handle.db.delete(shares);
    await fx.handle.db.insert(shares).values({
      id: '14141414-1414-4141-8141-141414141414',
      resourceType: 'area',
      resourceId: AREA,
      granteeUserId: GRANTEE,
      permission: 'edit',
      createdBy: OWNER,
      createdAt: NOW,
    });

    expect(
      await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'edit', {
        type: 'place',
        id: PLACE,
      }),
    ).toBe(true);
    expect(
      await can(fx.handle.db, { kind: 'user', userId: GRANTEE }, 'view', {
        type: 'point',
        id: POINT,
      }),
    ).toBe(true);

    // cleanup for later tests
    await fx.handle.db.delete(shares).where(eq(shares.id, '14141414-1414-4141-8141-141414141414'));
  });

  it('public link views inherited children but not private ones', async () => {
    const linkPrincipal = {
      kind: 'public_link' as const,
      resourceType: 'area' as const,
      resourceId: AREA,
    };

    expect(
      await can(fx.handle.db, linkPrincipal, 'view', { type: 'point', id: POINT }),
    ).toBe(true);
    expect(
      await can(fx.handle.db, linkPrincipal, 'view', {
        type: 'point',
        id: PRIVATE_POINT,
      }),
    ).toBe(false);
    expect(
      await can(fx.handle.db, linkPrincipal, 'edit', { type: 'point', id: POINT }),
    ).toBe(false);
  });

  it('assertCan throws ForbiddenError when denied', async () => {
    await expect(
      assertCan(
        fx.handle.db,
        { kind: 'anonymous' },
        'view' as Action,
        { type: 'place', id: PLACE },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
