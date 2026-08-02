import { permissionMatrixRows, type PrincipalKind, type SharePermission } from '@locus/shared';
import { describe, expect, it } from 'vitest';

import {
  evaluateLoaded,
  type LoadedResource,
  type Principal,
} from '../src/services/permissions.js';

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function resource(overrides: Partial<LoadedResource> = {}): LoadedResource {
  return {
    type: 'place',
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: OWNER,
    authorId: null,
    deletedAt: null,
    visibility: 'private',
    authorOnly: false,
    ancestorRefs: [],
    inPublicLinkScope: false,
    ...overrides,
  };
}

function principalFor(
  kind: PrincipalKind,
): { principal: Principal; share: SharePermission | null; resource: LoadedResource } {
  const base = resource();
  switch (kind) {
    case 'owner':
      return { principal: { kind: 'user', userId: OWNER }, share: null, resource: base };
    case 'share_edit':
      return {
        principal: { kind: 'user', userId: OTHER },
        share: 'edit',
        resource: base,
      };
    case 'share_comment':
      return {
        principal: { kind: 'user', userId: OTHER },
        share: 'comment',
        resource: base,
      };
    case 'share_view':
      return {
        principal: { kind: 'user', userId: OTHER },
        share: 'view',
        resource: base,
      };
    case 'public_link':
      return {
        principal: {
          kind: 'public_link',
          resourceType: 'place',
          resourceId: base.id,
        },
        share: null,
        resource: { ...base, inPublicLinkScope: true, visibility: 'unlisted' },
      };
    case 'authenticated_no_grant':
      return { principal: { kind: 'user', userId: OTHER }, share: null, resource: base };
    case 'anonymous_no_token':
      return { principal: { kind: 'anonymous' }, share: null, resource: base };
  }
}

describe('evaluateLoaded vs DESIGN §4 matrix fixture', () => {
  for (const row of permissionMatrixRows()) {
    it(`${row.principal} / ${row.action} ⇒ ${row.allowed}`, () => {
      const setup = principalFor(row.principal);
      const allowed = evaluateLoaded(
        setup.principal,
        row.action,
        setup.resource,
        setup.share,
      );
      expect(allowed).toBe(row.allowed);
    });
  }
});
