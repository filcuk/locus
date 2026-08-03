import { describe, expect, it } from 'vitest';

import { newEntityId } from '../ids.js';
import {
  AcceptInviteRequestSchema,
  CreateInviteRequestSchema,
  CreateInviteResponseSchema,
  CreateShareRequestSchema,
  InvitePublicSchema,
} from './sharing.js';

const RESOURCE = newEntityId();
const USER = newEntityId();

describe('sharing request schemas', () => {
  it('accepts create share', () => {
    const parsed = CreateShareRequestSchema.parse({
      resource_type: 'place',
      resource_id: RESOURCE,
      grantee_user_id: USER,
      permission: 'view',
    });
    expect(parsed.permission).toBe('view');
  });

  it('accepts create invite', () => {
    const parsed = CreateInviteRequestSchema.parse({
      email: 'friend@example.com',
      resource_type: 'area',
      resource_id: RESOURCE,
      permission: 'comment',
    });
    expect(parsed.email).toBe('friend@example.com');
  });

  it('accepts accept-invite token', () => {
    expect(AcceptInviteRequestSchema.parse({ token: 'opaque-token' }).token).toBe('opaque-token');
  });

  it('InvitePublicSchema omits token_hash', () => {
    const publicInvite = InvitePublicSchema.parse({
      id: newEntityId(),
      email: 'a@b.co',
      resource_type: 'point',
      resource_id: RESOURCE,
      permission: 'edit',
      expires_at: new Date().toISOString(),
      created_by: USER,
    });
    expect('token_hash' in publicInvite).toBe(false);
  });

  it('CreateInviteResponseSchema discriminates invite vs share', () => {
    const asInvite = CreateInviteResponseSchema.parse({
      kind: 'invite',
      invite: {
        id: newEntityId(),
        email: 'a@b.co',
        resource_type: 'collection',
        resource_id: RESOURCE,
        permission: 'view',
        expires_at: new Date().toISOString(),
        created_by: USER,
      },
      token: 'raw-once',
    });
    expect(asInvite.kind).toBe('invite');
  });
});
