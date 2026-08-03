import { describe, expect, it } from 'vitest';

import {
  AcceptInviteRequestSchema,
  CreateInviteRequestSchema,
  CreateInviteResponseSchema,
  CreateShareRequestSchema,
  InvitePublicSchema,
} from './sharing.js';

describe('sharing request/response schemas', () => {
  it('accepts a create-share body', () => {
    const parsed = CreateShareRequestSchema.parse({
      resource_type: 'place',
      resource_id: '11111111-1111-4111-8111-111111111111',
      grantee_user_id: '22222222-2222-4222-8222-222222222222',
      permission: 'view',
    });
    expect(parsed.permission).toBe('view');
  });

  it('accepts a create-invite body', () => {
    const parsed = CreateInviteRequestSchema.parse({
      email: 'new@example.com',
      resource_type: 'area',
      resource_id: '11111111-1111-4111-8111-111111111111',
      permission: 'comment',
    });
    expect(parsed.email).toBe('new@example.com');
  });

  it('omits token_hash from InvitePublic', () => {
    const result = InvitePublicSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'a@b.co',
      resource_type: 'point',
      resource_id: '22222222-2222-4222-8222-222222222222',
      permission: 'edit',
      expires_at: '2026-01-01T00:00:00.000Z',
      created_by: '33333333-3333-4333-8333-333333333333',
      token_hash: 'should-not-be-here',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('token_hash' in result.data).toBe(false);
    }
  });

  it('accepts invite-created and share-created responses', () => {
    expect(
      CreateInviteResponseSchema.parse({
        kind: 'share',
        share: {
          id: '11111111-1111-4111-8111-111111111111',
          resource_type: 'place',
          resource_id: '22222222-2222-4222-8222-222222222222',
          grantee_user_id: '33333333-3333-4333-8333-333333333333',
          permission: 'view',
          created_by: '44444444-4444-4444-8444-444444444444',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      }).kind,
    ).toBe('share');

    expect(
      AcceptInviteRequestSchema.parse({ token: 'opaque-token' }).token,
    ).toBe('opaque-token');
  });
});
