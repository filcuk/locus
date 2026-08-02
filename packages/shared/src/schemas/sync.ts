import { z } from 'zod';

import { UuidSchema } from './common.js';
import {
  AreaSchema,
  CollectionItemSchema,
  CollectionSchema,
  CommentSchema,
  NoteSchema,
  PhotoSchema,
  PlaceSchema,
  PointSchema,
  ShareSchema,
  TaggingSchema,
  TagSchema,
} from './entities.js';

/**
 * Tables that ride the WatermelonDB pull/push wire (DESIGN §5).
 * Every key is always present in a pull response, even when empty.
 */
export const SYNCED_TABLES = [
  'areas',
  'places',
  'points',
  'collections',
  'collection_items',
  'tags',
  'taggings',
  'notes',
  'comments',
  'photos',
  'shares',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const SyncedTableSchema = z.enum(SYNCED_TABLES);

/** DESIGN §5 error codes — HTTP status is documented beside each. */
export const SyncErrorCodeSchema = z.enum([
  'PULL_REQUIRED', // 409
  'CURSOR_TOO_OLD', // 409 — client restarts at cursor=0
  'SCHEMA_VERSION_UNSUPPORTED', // 426
  'FORBIDDEN', // 403
  'VALIDATION_FAILED', // 422
]);
export type SyncErrorCode = z.infer<typeof SyncErrorCodeSchema>;

export const SyncErrorCodes = {
  PULL_REQUIRED: 'PULL_REQUIRED',
  CURSOR_TOO_OLD: 'CURSOR_TOO_OLD',
  SCHEMA_VERSION_UNSUPPORTED: 'SCHEMA_VERSION_UNSUPPORTED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const satisfies Record<SyncErrorCode, SyncErrorCode>;

export const SyncErrorHttpStatus: Record<SyncErrorCode, number> = {
  PULL_REQUIRED: 409,
  CURSOR_TOO_OLD: 409,
  SCHEMA_VERSION_UNSUPPORTED: 426,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 422,
};

const tableChanges = <Row extends z.ZodType>(row: Row) =>
  z.object({
    created: z.array(row),
    updated: z.array(row),
    deleted: z.array(UuidSchema),
  });

export const SyncChangesSchema = z.object({
  areas: tableChanges(AreaSchema),
  places: tableChanges(PlaceSchema),
  points: tableChanges(PointSchema),
  collections: tableChanges(CollectionSchema),
  collection_items: tableChanges(CollectionItemSchema),
  tags: tableChanges(TagSchema),
  taggings: tableChanges(TaggingSchema),
  notes: tableChanges(NoteSchema),
  comments: tableChanges(CommentSchema),
  photos: tableChanges(PhotoSchema),
  shares: tableChanges(ShareSchema),
});
export type SyncChanges = z.infer<typeof SyncChangesSchema>;

/** Empty changes bag — every synced table present. */
export function emptySyncChanges(): SyncChanges {
  const empty = { created: [], updated: [], deleted: [] } as const;
  return {
    areas: { ...empty, created: [], updated: [], deleted: [] },
    places: { ...empty, created: [], updated: [], deleted: [] },
    points: { ...empty, created: [], updated: [], deleted: [] },
    collections: { ...empty, created: [], updated: [], deleted: [] },
    collection_items: { ...empty, created: [], updated: [], deleted: [] },
    tags: { ...empty, created: [], updated: [], deleted: [] },
    taggings: { ...empty, created: [], updated: [], deleted: [] },
    notes: { ...empty, created: [], updated: [], deleted: [] },
    comments: { ...empty, created: [], updated: [], deleted: [] },
    photos: { ...empty, created: [], updated: [], deleted: [] },
    shares: { ...empty, created: [], updated: [], deleted: [] },
  };
}

/** `GET /sync/pull` query — `cursor` is server_seq; `0` means full sync. */
export const SyncPullQuerySchema = z.object({
  cursor: z.coerce.number().int().nonnegative(),
  device_id: UuidSchema,
  schema_version: z.coerce.number().int().positive(),
});
export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

/**
 * Pull response. `timestamp` is WatermelonDB's field name for our
 * fully-committed `server_seq` watermark (DESIGN §5).
 */
export const SyncPullResponseSchema = z.object({
  changes: SyncChangesSchema,
  timestamp: z.number().int().nonnegative(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponseSchema>;

export const SyncPushRequestSchema = z.object({
  push_id: UuidSchema,
  cursor: z.number().int().nonnegative(),
  device_id: UuidSchema,
  changes: SyncChangesSchema.partial(),
});
export type SyncPushRequest = z.infer<typeof SyncPushRequestSchema>;

export const SyncRejectionSchema = z.object({
  table: SyncedTableSchema,
  id: UuidSchema,
  code: SyncErrorCodeSchema,
  message: z.string(),
});
export type SyncRejection = z.infer<typeof SyncRejectionSchema>;

export const SyncPushResponseSchema = z.object({
  applied: z.number().int().nonnegative(),
  timestamp: z.number().int().nonnegative(),
  rejected: z.array(SyncRejectionSchema),
});
export type SyncPushResponse = z.infer<typeof SyncPushResponseSchema>;
