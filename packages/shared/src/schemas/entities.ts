import { z } from 'zod';

import {
  AreaGeometrySchema,
  CollectionItemTypeSchema,
  IsoDateTimeSchema,
  LatitudeSchema,
  LongitudeSchema,
  PositionSourceSchema,
  ResourceTypeSchema,
  SharePermissionSchema,
  TagScopeSchema,
  TargetTypeSchema,
  UploadStateSchema,
  UuidSchema,
  VisibilitySchema,
} from './common.js';

export const UserSchema = z.object({
  id: UuidSchema,
  email: z.email(),
  email_verified_at: IsoDateTimeSchema.nullable().optional(),
  display_name: z.string().min(1),
  // password_hash is server-only; never appear in sync or client payloads
  created_at: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;

export const AreaSchema = z.object({
  id: UuidSchema,
  owner_id: UuidSchema,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  geom_geojson: AreaGeometrySchema,
  bbox_min_lat: LatitudeSchema,
  bbox_min_lon: LongitudeSchema,
  bbox_max_lat: LatitudeSchema,
  bbox_max_lon: LongitudeSchema,
  visibility: VisibilitySchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  updated_by: UuidSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type Area = z.infer<typeof AreaSchema>;

export const PlaceSchema = z.object({
  id: UuidSchema,
  owner_id: UuidSchema,
  area_id: UuidSchema.nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  lat: LatitudeSchema.nullable().optional(),
  lon: LongitudeSchema.nullable().optional(),
  elevation_m: z.number().nullable().optional(),
  position_source: PositionSourceSchema.nullable().optional(),
  visibility: VisibilitySchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  updated_by: UuidSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type Place = z.infer<typeof PlaceSchema>;

/**
 * A point belongs to a place **or** an area, never both (DESIGN §4).
 * Standalone points set both parent ids to null/undefined.
 */
export const PointSchema = z
  .object({
    id: UuidSchema,
    owner_id: UuidSchema,
    place_id: UuidSchema.nullable().optional(),
    area_id: UuidSchema.nullable().optional(),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    lat: LatitudeSchema,
    lon: LongitudeSchema,
    elevation_m: z.number().nullable().optional(),
    position_source: PositionSourceSchema.nullable().optional(),
    feature_kind: z.string().nullable().optional(),
    recorded_at: IsoDateTimeSchema.nullable().optional(),
    visibility: VisibilitySchema,
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    updated_by: UuidSchema,
    deleted_at: IsoDateTimeSchema.nullable().optional(),
  })
  .refine((row) => !(row.place_id != null && row.area_id != null), {
    message: 'A point may belong to a place or an area, never both',
    path: ['place_id'],
  });
export type Point = z.infer<typeof PointSchema>;

export const CollectionSchema = z.object({
  id: UuidSchema,
  owner_id: UuidSchema,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  visibility: VisibilitySchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  updated_by: UuidSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const CollectionItemSchema = z.object({
  id: UuidSchema,
  collection_id: UuidSchema,
  item_type: CollectionItemTypeSchema,
  item_id: UuidSchema,
  position: z.number().int().nullable().optional(),
  added_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type CollectionItem = z.infer<typeof CollectionItemSchema>;

export const TagSchema = z.object({
  id: UuidSchema,
  scope: TagScopeSchema,
  owner_id: UuidSchema.nullable().optional(),
  namespace: z.string().min(1).nullable().optional(),
  label: z.string().min(1),
  colour: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  retired_at: IsoDateTimeSchema.nullable().optional(),
});
export type Tag = z.infer<typeof TagSchema>;

export const TaggingSchema = z.object({
  id: UuidSchema,
  tag_id: UuidSchema,
  target_type: TargetTypeSchema,
  target_id: UuidSchema,
  created_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
  /** Denormalised from Tag at assign time (DESIGN §4 Tagging). */
  tag_label: z.string().min(1),
  tag_colour: z.string().nullable().optional(),
  tag_scope: TagScopeSchema,
  tag_namespace: z.string().min(1).nullable().optional(),
});
export type Tagging = z.infer<typeof TaggingSchema>;

/** Personal timeline — private to its author always (DESIGN §4). */
export const NoteSchema = z
  .object({
    id: UuidSchema,
    author_id: UuidSchema,
    target_type: TargetTypeSchema,
    target_id: UuidSchema,
    body: z.string().nullable().optional(),
    visited_at: IsoDateTimeSchema.nullable().optional(),
    created_at: IsoDateTimeSchema,
    updated_at: IsoDateTimeSchema,
    deleted_at: IsoDateTimeSchema.nullable().optional(),
  })
  .refine((row) => row.body != null || row.visited_at != null, {
    message: 'A note requires body or visited_at (or both)',
    path: ['body'],
  });
export type Note = z.infer<typeof NoteSchema>;

export const CommentSchema = z.object({
  id: UuidSchema,
  author_id: UuidSchema,
  target_type: TargetTypeSchema,
  target_id: UuidSchema,
  body: z.string().min(1),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const PhotoSchema = z.object({
  id: UuidSchema,
  owner_id: UuidSchema,
  target_type: TargetTypeSchema,
  target_id: UuidSchema,
  sha256: z.string().nullable().optional(),
  storage_key: z.string().nullable().optional(),
  content_type: z.string().min(1),
  byte_size: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  caption: z.string().nullable().optional(),
  upload_state: UploadStateSchema,
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable().optional(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const ShareSchema = z.object({
  id: UuidSchema,
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
  grantee_user_id: UuidSchema,
  permission: SharePermissionSchema,
  created_by: UuidSchema,
  created_at: IsoDateTimeSchema,
});
export type Share = z.infer<typeof ShareSchema>;

export const InviteSchema = z.object({
  id: UuidSchema,
  email: z.email(),
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
  permission: SharePermissionSchema,
  // token_hash only — raw GUID never leaves the URL / creation response
  token_hash: z.string().min(1),
  expires_at: IsoDateTimeSchema,
  created_by: UuidSchema,
});
export type Invite = z.infer<typeof InviteSchema>;

export const PublicLinkSchema = z.object({
  id: UuidSchema,
  resource_type: ResourceTypeSchema,
  resource_id: UuidSchema,
  token_hash: z.string().min(1),
  permission: z.literal('view'),
  expires_at: IsoDateTimeSchema.nullable().optional(),
  revoked_at: IsoDateTimeSchema.nullable().optional(),
  created_by: UuidSchema,
});
export type PublicLink = z.infer<typeof PublicLinkSchema>;

export const ChangeLogSchema = z.object({
  server_seq: z.number().int().nonnegative(),
  entity_type: z.string().min(1),
  entity_id: UuidSchema,
  op: z.enum(['create', 'update', 'delete']),
  payload: z.unknown(),
  actor_id: UuidSchema,
  device_id: UuidSchema,
  created_at: IsoDateTimeSchema,
});
export type ChangeLog = z.infer<typeof ChangeLogSchema>;

export const RefreshTokenSchema = z.object({
  id: UuidSchema,
  user_id: UuidSchema,
  token_hash: z.string().min(1),
  device_id: UuidSchema,
  expires_at: IsoDateTimeSchema,
  revoked_at: IsoDateTimeSchema.nullable().optional(),
});
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
