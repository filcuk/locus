/**
 * Single ACL implementation for REST, sync, media, and WS (DESIGN §4 / §7).
 * No route may inline ownership checks — call `can` / `assertCan` instead.
 */
import {
  allowsResolved,
  isAuthorOnlyResource,
  isSoftDeleted,
  maxSharePermission,
  resolvePrincipalKind,
  type Action,
  type SharePermission,
  type Visibility,
} from '@locus/shared';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import type { DbHandle } from '../db/client.js';
import {
  areas,
  collections,
  notes,
  places,
  points,
  publicLinks,
  shares,
  tags,
} from '../db/schema.js';

export type ResourceType =
  | 'area'
  | 'place'
  | 'point'
  | 'collection'
  | 'note'
  | 'tag';

export type Principal =
  | { kind: 'anonymous' }
  | { kind: 'user'; userId: string }
  | {
      kind: 'public_link';
      resourceType: 'area' | 'place' | 'point' | 'collection';
      resourceId: string;
    };

export type ResourceRef = {
  type: ResourceType;
  id: string;
};

export type LoadedResource = {
  type: ResourceType;
  id: string;
  ownerId: string | null;
  authorId: string | null;
  deletedAt: string | null | undefined;
  visibility: Visibility | null;
  authorOnly: boolean;
  ancestorRefs: Array<{ type: 'area' | 'place' | 'point' | 'collection'; id: string }>;
  inPublicLinkScope: boolean;
};

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * `can(principal, action, resource)` — the only ACL entry point.
 * Loads the resource and evaluates DESIGN §4 resolution order via shared predicates.
 */
export async function can(
  db: DbHandle['db'],
  principal: Principal,
  action: Action,
  resource: ResourceRef,
): Promise<boolean> {
  const loaded = await loadResource(db, resource);
  if (loaded === null) return false;
  return evaluate(db, principal, action, loaded);
}

export async function assertCan(
  db: DbHandle['db'],
  principal: Principal,
  action: Action,
  resource: ResourceRef,
): Promise<void> {
  const allowed = await can(db, principal, action, resource);
  if (!allowed) throw new ForbiddenError();
}

/** Pure evaluation once the resource graph is loaded — used by fixtures/tests. */
export function evaluateLoaded(
  principal: Principal,
  action: Action,
  resource: LoadedResource,
  effectiveShare: SharePermission | null,
): boolean {
  const authenticated = principal.kind === 'user';
  const principalUserId = principal.kind === 'user' ? principal.userId : null;

  const isOwner =
    principalUserId != null &&
    ((resource.ownerId != null && resource.ownerId === principalUserId) ||
      (resource.authorId != null && resource.authorId === principalUserId));

  const isAuthorOrOwner =
    principalUserId != null &&
    ((resource.authorId != null && resource.authorId === principalUserId) ||
      (resource.ownerId != null && resource.ownerId === principalUserId));

  const publicLinkInScope =
    principal.kind === 'public_link' && resource.inPublicLinkScope;

  // Linked root is always viewable; only inherited children honour visibility
  // (DESIGN §4 rule 4 — "linked resource plus inherited children whose
  // visibility is not private").
  const isPublicLinkRoot =
    principal.kind === 'public_link' &&
    resource.type === principal.resourceType &&
    resource.id === principal.resourceId;

  const kind = resolvePrincipalKind({
    softDeleted: isSoftDeleted(resource.deletedAt),
    authorOnly: resource.authorOnly,
    isAuthorOrOwner,
    isOwner,
    publicLinkInScope,
    visibility: isPublicLinkRoot ? null : resource.visibility,
    // Public-link path wins before shares in §4 order; do not mix grants in.
    effectiveShare: publicLinkInScope ? null : effectiveShare,
    authenticated,
  });

  return allowsResolved(kind, action);
}

async function evaluate(
  db: DbHandle['db'],
  principal: Principal,
  action: Action,
  resource: LoadedResource,
): Promise<boolean> {
  if (principal.kind === 'public_link') {
    const inScope = isInPublicLinkScope(principal, resource);
    const scoped: LoadedResource = { ...resource, inPublicLinkScope: inScope };
    return evaluateLoaded(principal, action, scoped, null);
  }

  const effectiveShare =
    principal.kind === 'user'
      ? await resolveEffectiveShare(db, principal.userId, resource)
      : null;

  return evaluateLoaded(principal, action, resource, effectiveShare);
}

async function loadResource(
  db: DbHandle['db'],
  ref: ResourceRef,
): Promise<LoadedResource | null> {
  switch (ref.type) {
    case 'area': {
      const [row] = await db.select().from(areas).where(eq(areas.id, ref.id)).limit(1);
      if (!row) return null;
      return baseOwned('area', row.id, row.ownerId, row.deletedAt, row.visibility, []);
    }
    case 'place': {
      const [row] = await db.select().from(places).where(eq(places.id, ref.id)).limit(1);
      if (!row) return null;
      const ancestors: LoadedResource['ancestorRefs'] = [];
      if (row.areaId) ancestors.push({ type: 'area', id: row.areaId });
      return baseOwned('place', row.id, row.ownerId, row.deletedAt, row.visibility, ancestors);
    }
    case 'point': {
      const [row] = await db.select().from(points).where(eq(points.id, ref.id)).limit(1);
      if (!row) return null;
      const ancestors: LoadedResource['ancestorRefs'] = [];
      if (row.placeId) {
        ancestors.push({ type: 'place', id: row.placeId });
        const [place] = await db
          .select()
          .from(places)
          .where(eq(places.id, row.placeId))
          .limit(1);
        if (place?.areaId) ancestors.push({ type: 'area', id: place.areaId });
      } else if (row.areaId) {
        ancestors.push({ type: 'area', id: row.areaId });
      }
      return baseOwned('point', row.id, row.ownerId, row.deletedAt, row.visibility, ancestors);
    }
    case 'collection': {
      const [row] = await db
        .select()
        .from(collections)
        .where(eq(collections.id, ref.id))
        .limit(1);
      if (!row) return null;
      return baseOwned(
        'collection',
        row.id,
        row.ownerId,
        row.deletedAt,
        row.visibility,
        [],
      );
    }
    case 'note': {
      const [row] = await db.select().from(notes).where(eq(notes.id, ref.id)).limit(1);
      if (!row) return null;
      return {
        type: 'note',
        id: row.id,
        ownerId: null,
        authorId: row.authorId,
        deletedAt: row.deletedAt,
        visibility: null,
        authorOnly: isAuthorOnlyResource({ kind: 'note' }),
        ancestorRefs: [],
        inPublicLinkScope: false,
      };
    }
    case 'tag': {
      const [row] = await db.select().from(tags).where(eq(tags.id, ref.id)).limit(1);
      if (!row) return null;
      const scope = row.scope === 'user' ? 'user' : 'system';
      return {
        type: 'tag',
        id: row.id,
        ownerId: row.ownerId,
        authorId: null,
        deletedAt: null,
        visibility: null,
        authorOnly: isAuthorOnlyResource({ kind: 'tag', scope }),
        ancestorRefs: [],
        inPublicLinkScope: false,
      };
    }
  }
}

function baseOwned(
  type: 'area' | 'place' | 'point' | 'collection',
  id: string,
  ownerId: string,
  deletedAt: string | null,
  visibility: string,
  ancestorRefs: LoadedResource['ancestorRefs'],
): LoadedResource {
  return {
    type,
    id,
    ownerId,
    authorId: null,
    deletedAt,
    visibility: visibility as Visibility,
    authorOnly: false,
    ancestorRefs,
    inPublicLinkScope: false,
  };
}

async function resolveEffectiveShare(
  db: DbHandle['db'],
  userId: string,
  resource: LoadedResource,
): Promise<SharePermission | null> {
  if (
    resource.type !== 'area' &&
    resource.type !== 'place' &&
    resource.type !== 'point' &&
    resource.type !== 'collection'
  ) {
    return null;
  }

  const targets: Array<{ type: string; id: string }> = [
    { type: resource.type, id: resource.id },
    ...resource.ancestorRefs,
  ];

  const grants: SharePermission[] = [];
  for (const target of targets) {
    const rows = await db
      .select({ permission: shares.permission })
      .from(shares)
      .where(
        and(
          eq(shares.granteeUserId, userId),
          eq(shares.resourceType, target.type),
          eq(shares.resourceId, target.id),
        ),
      );
    for (const row of rows) {
      grants.push(row.permission as SharePermission);
    }
  }
  return maxSharePermission(...grants);
}

function isInPublicLinkScope(
  principal: Extract<Principal, { kind: 'public_link' }>,
  resource: LoadedResource,
): boolean {
  if (
    resource.type === principal.resourceType &&
    resource.id === principal.resourceId
  ) {
    return true;
  }
  return resource.ancestorRefs.some(
    (a) => a.type === principal.resourceType && a.id === principal.resourceId,
  );
}

/** Confirm a public-link token hash is still valid (not revoked / expired). */
export async function findActivePublicLink(
  db: DbHandle['db'],
  tokenHash: string,
): Promise<{
  resourceType: 'area' | 'place' | 'point' | 'collection';
  resourceId: string;
} | null> {
  const [row] = await db
    .select()
    .from(publicLinks)
    .where(
      and(
        eq(publicLinks.tokenHash, tokenHash),
        isNull(publicLinks.revokedAt),
        or(isNull(publicLinks.expiresAt), sql`${publicLinks.expiresAt} > now()`),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    resourceType: row.resourceType as 'area' | 'place' | 'point' | 'collection',
    resourceId: row.resourceId,
  };
}
