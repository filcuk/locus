/**
 * DESIGN §4 permission matrix — the authoritative fixture.
 * API `can()` tests and client predicates must iterate this table; a behaviour
 * change here fails CI until implementations agree.
 */

export const ACTIONS = [
  'view',
  'comment',
  'create_child',
  'edit',
  'delete',
  'manage_shares',
] as const;
export type Action = (typeof ACTIONS)[number];

export const PRINCIPAL_KINDS = [
  'owner',
  'share_edit',
  'share_comment',
  'share_view',
  'public_link',
  'authenticated_no_grant',
  'anonymous_no_token',
] as const;
export type PrincipalKind = (typeof PRINCIPAL_KINDS)[number];

export type PermissionRow = Readonly<Record<Action, boolean>>;

/** Exact encoding of the DESIGN §4 matrix. */
export const PERMISSION_MATRIX = {
  owner: {
    view: true,
    comment: true,
    create_child: true,
    edit: true,
    delete: true,
    manage_shares: true,
  },
  share_edit: {
    view: true,
    comment: true,
    create_child: true,
    edit: true,
    delete: false,
    manage_shares: false,
  },
  share_comment: {
    view: true,
    comment: true,
    create_child: false,
    edit: false,
    delete: false,
    manage_shares: false,
  },
  share_view: {
    view: true,
    comment: false,
    create_child: false,
    edit: false,
    delete: false,
    manage_shares: false,
  },
  public_link: {
    view: true,
    comment: false,
    create_child: false,
    edit: false,
    delete: false,
    manage_shares: false,
  },
  authenticated_no_grant: {
    view: false,
    comment: false,
    create_child: false,
    edit: false,
    delete: false,
    manage_shares: false,
  },
  anonymous_no_token: {
    view: false,
    comment: false,
    create_child: false,
    edit: false,
    delete: false,
    manage_shares: false,
  },
} as const satisfies Record<PrincipalKind, PermissionRow>;

export type PermissionMatrix = typeof PERMISSION_MATRIX;

/** Flattened rows for fixture iteration (Vitest / Testcontainers). */
export function permissionMatrixRows(): ReadonlyArray<{
  principal: PrincipalKind;
  action: Action;
  allowed: boolean;
}> {
  const rows: Array<{ principal: PrincipalKind; action: Action; allowed: boolean }> = [];
  for (const principal of PRINCIPAL_KINDS) {
    for (const action of ACTIONS) {
      rows.push({
        principal,
        action,
        allowed: PERMISSION_MATRIX[principal][action],
      });
    }
  }
  return rows;
}
