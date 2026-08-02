import { describe, expect, it } from 'vitest';

import {
  ACTIONS,
  PERMISSION_MATRIX,
  PRINCIPAL_KINDS,
  permissionMatrixRows,
  type Action,
  type PrincipalKind,
} from './matrix.js';

/** Literal copy of DESIGN §4 — changing either side must fail this test. */
const DESIGN_MATRIX: Record<PrincipalKind, Record<Action, boolean>> = {
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
};

describe('permission matrix fixture (DESIGN §4)', () => {
  it('matches the design table cell-for-cell', () => {
    for (const principal of PRINCIPAL_KINDS) {
      for (const action of ACTIONS) {
        expect(PERMISSION_MATRIX[principal][action]).toBe(DESIGN_MATRIX[principal][action]);
      }
    }
  });

  it('exports one row per principal × action for API iteration', () => {
    const rows = permissionMatrixRows();
    expect(rows).toHaveLength(PRINCIPAL_KINDS.length * ACTIONS.length);
    expect(rows.every((row) => typeof row.allowed === 'boolean')).toBe(true);
  });
});
