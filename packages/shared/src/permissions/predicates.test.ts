import { describe, expect, it } from 'vitest';

import {
  allowsResolved,
  isAuthorOnlyResource,
  isSoftDeleted,
  matrixAllows,
  maxSharePermission,
  publicLinkMayView,
  resolvePrincipalKind,
  shareToPrincipalKind,
} from './predicates.js';

describe('permission predicates (DESIGN §4 resolution order)', () => {
  it('ranks share grants with edit strongest', () => {
    expect(maxSharePermission('view', 'edit', 'comment')).toBe('edit');
    expect(shareToPrincipalKind('comment')).toBe('share_comment');
  });

  it('denies soft-deleted resources before any grant', () => {
    expect(isSoftDeleted('2026-08-02T12:00:00.000Z')).toBe(true);
    const kind = resolvePrincipalKind({
      softDeleted: true,
      authorOnly: false,
      isAuthorOrOwner: false,
      isOwner: true,
      publicLinkInScope: false,
      effectiveShare: 'edit',
      authenticated: true,
    });
    expect(kind).toBe('denied_soft_delete');
    expect(allowsResolved(kind, 'view')).toBe(false);
  });

  it('keeps notes and user tags author-only for catalog ACL', () => {
    expect(isAuthorOnlyResource({ kind: 'note' })).toBe(true);
    expect(isAuthorOnlyResource({ kind: 'tag', scope: 'user' })).toBe(true);
    expect(isAuthorOnlyResource({ kind: 'tag', scope: 'system' })).toBe(false);

    const stranger = resolvePrincipalKind({
      softDeleted: false,
      authorOnly: true,
      isAuthorOrOwner: false,
      isOwner: false,
      publicLinkInScope: false,
      effectiveShare: 'edit',
      authenticated: true,
    });
    expect(stranger).toBe('denied_author_only');
  });

  it('lets owner win over shares', () => {
    const kind = resolvePrincipalKind({
      softDeleted: false,
      authorOnly: false,
      isAuthorOrOwner: true,
      isOwner: true,
      publicLinkInScope: true,
      effectiveShare: 'view',
      authenticated: true,
    });
    expect(kind).toBe('owner');
    if (kind !== 'owner') throw new Error('expected owner');
    expect(matrixAllows(kind, 'manage_shares')).toBe(true);
  });

  it('restricts public links to view and excludes private children', () => {
    expect(
      publicLinkMayView({ action: 'view', inLinkScope: true, visibility: 'unlisted' }),
    ).toBe(true);
    expect(
      publicLinkMayView({ action: 'view', inLinkScope: true, visibility: 'private' }),
    ).toBe(false);
    expect(
      publicLinkMayView({ action: 'comment', inLinkScope: true, visibility: 'public' }),
    ).toBe(false);
  });

  it('falls through to share then deny', () => {
    expect(
      resolvePrincipalKind({
        softDeleted: false,
        authorOnly: false,
        isAuthorOrOwner: false,
        isOwner: false,
        publicLinkInScope: false,
        effectiveShare: 'edit',
        authenticated: true,
      }),
    ).toBe('share_edit');

    expect(
      resolvePrincipalKind({
        softDeleted: false,
        authorOnly: false,
        isAuthorOrOwner: false,
        isOwner: false,
        publicLinkInScope: false,
        effectiveShare: null,
        authenticated: false,
      }),
    ).toBe('anonymous_no_token');
  });
});
