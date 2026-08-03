import { z } from 'zod';

import { EmailSchema } from './auth.js';
import {
  IsoDateTimeSchema,
  ResourceTypeSchema,
  SharePermissionSchema,
  UuidSchema,
} from './common.js';
import { InviteSchema, ShareSchema } from './entities.js';

/** Create a share for an existing user (DESIGN §4). */
export const CreateShareRequestSchema = z.object({
  id: UuidSchema.optional(),
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
  grantee_user_id: UuidSchema,
  permission: SharePermissionSchema,
});
export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;

/** Create an invite for an email that may not have an account yet (DESIGN §4). */
export const CreateInviteRequestSchema = z.object({
  id: UuidSchema.optional(),
  email: EmailSchema,
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
  permission: SharePermissionSchema,
});
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;

/** Redeem an invite with the raw token (never stored; DESIGN §10). */
export const AcceptInviteRequestSchema = z.object({
  token: z.string().min(1).max(256),
});
export type AcceptInviteRequest = z.infer<typeof AcceptInviteRequestSchema>;

export const ListSharesQuerySchema = z.object({
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
});
export type ListSharesQuery = z.infer<typeof ListSharesQuerySchema>;

export const ListInvitesQuerySchema = ListSharesQuerySchema;
export type ListInvitesQuery = z.infer<typeof ListInvitesQuerySchema>;

/**
 * Invite as returned to clients — `token_hash` never leaves the server
 * (DESIGN §4 / §10). Raw token is only in `InviteCreatedResponse.token`.
 */
export const InvitePublicSchema = InviteSchema.omit({ token_hash: true });
export type InvitePublic = z.infer<typeof InvitePublicSchema>;

export const ShareListResponseSchema = z.object({
  shares: z.array(ShareSchema),
});
export type ShareListResponse = z.infer<typeof ShareListResponseSchema>;

export const InviteListResponseSchema = z.object({
  invites: z.array(InvitePublicSchema),
});
export type InviteListResponse = z.infer<typeof InviteListResponseSchema>;

/**
 * Invite create result. When the email already has an account we mint a share
 * instead (Invite is for “no account yet” — DESIGN §4).
 */
export const CreateInviteResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('invite'),
    invite: InvitePublicSchema,
    /** Raw invite GUID — shown once; never logged. */
    token: z.string().min(1),
  }),
  z.object({
    kind: z.literal('share'),
    share: ShareSchema,
  }),
]);
export type CreateInviteResponse = z.infer<typeof CreateInviteResponseSchema>;

export const AcceptInviteResponseSchema = z.object({
  share: ShareSchema,
});
export type AcceptInviteResponse = z.infer<typeof AcceptInviteResponseSchema>;
