import type { SharePermission, Visibility } from '../schemas/common.js';
import { PERMISSION_MATRIX, type Action, type PrincipalKind } from './matrix.js';

const SHARE_RANK: Record<SharePermission, number> = {
  view: 1,
  comment: 2,
  edit: 3,
};

/** Direct matrix lookup — does this principal kind get this action? */
export function matrixAllows(principal: PrincipalKind, action: Action): boolean {
  return PERMISSION_MATRIX[principal][action];
}

export function shareRank(permission: SharePermission): number {
  return SHARE_RANK[permission];
}

/** Strongest grant wins (`edit` > `comment` > `view`). */
export function maxSharePermission(
  ...grants: ReadonlyArray<SharePermission | null | undefined>
): SharePermission | null {
  let best: SharePermission | null = null;
  for (const grant of grants) {
    if (grant == null) continue;
    if (best == null || SHARE_RANK[grant] > SHARE_RANK[best]) {
      best = grant;
    }
  }
  return best;
}

export function shareToPrincipalKind(permission: SharePermission): PrincipalKind {
  switch (permission) {
    case 'edit':
      return 'share_edit';
    case 'comment':
      return 'share_comment';
    case 'view':
      return 'share_view';
  }
}

/** Rule 1 — soft-deleted rows are invisible to every principal. */
export function isSoftDeleted(deletedAt: string | null | undefined): boolean {
  return deletedAt != null;
}

/**
 * Rule 2 — notes and user-scoped tags are author/owner only.
 * Callers still enforce the author/owner id match.
 */
export function isAuthorOnlyResource(
  resource:
    | { kind: 'note' }
    | { kind: 'tag'; scope: 'system' | 'user' }
    | { kind: 'other' },
): boolean {
  if (resource.kind === 'note') return true;
  if (resource.kind === 'tag' && resource.scope === 'user') return true;
  return false;
}

/** Rule 3 — owner always wins. */
export function isResourceOwner(
  ownerId: string,
  principalUserId: string | null | undefined,
): boolean {
  return principalUserId != null && principalUserId === ownerId;
}

/**
 * Rule 4 — public-link view on the linked resource and inherited children
 * whose visibility is not `private`. Tokens never grant write/comment.
 */
export function publicLinkMayView(args: {
  action: Action;
  /** True when the resource is the linked root or an inherited child. */
  inLinkScope: boolean;
  /** Child visibility; omit / null for the linked root itself. */
  visibility?: Visibility | null;
}): boolean {
  if (args.action !== 'view') return false;
  if (!args.inLinkScope) return false;
  if (args.visibility === 'private') return false;
  return matrixAllows('public_link', 'view');
}

/**
 * Map a resolved access path onto a matrix principal kind.
 * Inheritance / ancestor walks stay in the API; this only classifies the outcome.
 */
export function resolvePrincipalKind(input: {
  softDeleted: boolean;
  authorOnly: boolean;
  isAuthorOrOwner: boolean;
  isOwner: boolean;
  publicLinkInScope: boolean;
  /** Child visibility when evaluating a public-link inherited child. */
  visibility?: Visibility | null;
  effectiveShare: SharePermission | null;
  authenticated: boolean;
}): PrincipalKind | 'denied_soft_delete' | 'denied_author_only' {
  // Resolution order — first match wins (DESIGN §4).
  if (input.softDeleted) return 'denied_soft_delete';
  if (input.authorOnly) {
    return input.isAuthorOrOwner ? 'owner' : 'denied_author_only';
  }
  if (input.isOwner) return 'owner';
  if (input.publicLinkInScope) {
    if (input.visibility === 'private') {
      // fall through — private children are excluded from public-link exposure
    } else {
      return 'public_link';
    }
  }
  if (input.effectiveShare != null) {
    return shareToPrincipalKind(input.effectiveShare);
  }
  return input.authenticated ? 'authenticated_no_grant' : 'anonymous_no_token';
}

/**
 * Pure evaluation of the matrix after resolution.
 * Returns false for soft-delete / author-only denials.
 */
export function allowsResolved(
  kind: PrincipalKind | 'denied_soft_delete' | 'denied_author_only',
  action: Action,
): boolean {
  if (kind === 'denied_soft_delete' || kind === 'denied_author_only') return false;
  return matrixAllows(kind, action);
}
