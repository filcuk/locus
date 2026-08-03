import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/** timestamptz as ISO strings — server clocks only (DESIGN §5). */
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' });

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: ts('email_verified_at'),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const areas = pgTable('areas', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  geomGeojson: jsonb('geom_geojson').notNull(),
  bboxMinLat: doublePrecision('bbox_min_lat').notNull(),
  bboxMinLon: doublePrecision('bbox_min_lon').notNull(),
  bboxMaxLat: doublePrecision('bbox_max_lat').notNull(),
  bboxMaxLon: doublePrecision('bbox_max_lon').notNull(),
  visibility: text('visibility').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
  deletedAt: ts('deleted_at'),
});

export const places = pgTable('places', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  areaId: uuid('area_id').references(() => areas.id),
  title: text('title').notNull(),
  description: text('description'),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  elevationM: doublePrecision('elevation_m'),
  positionSource: text('position_source'),
  visibility: text('visibility').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
  deletedAt: ts('deleted_at'),
});

/** Point → place XOR area (DESIGN §4); CHECK enforces never both. */
export const points = pgTable(
  'points',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    placeId: uuid('place_id').references(() => places.id),
    areaId: uuid('area_id').references(() => areas.id),
    title: text('title').notNull(),
    description: text('description'),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    elevationM: doublePrecision('elevation_m'),
    positionSource: text('position_source'),
    featureKind: text('feature_kind'),
    recordedAt: ts('recorded_at'),
    visibility: text('visibility').notNull(),
    createdAt: ts('created_at').notNull(),
    updatedAt: ts('updated_at').notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => users.id),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    check(
      'points_place_xor_area',
      sql`not (${t.placeId} is not null and ${t.areaId} is not null)`,
    ),
  ],
);

export const collections = pgTable('collections', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  visibility: text('visibility').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  updatedBy: uuid('updated_by')
    .notNull()
    .references(() => users.id),
  deletedAt: ts('deleted_at'),
});

export const collectionItems = pgTable('collection_items', {
  id: uuid('id').primaryKey(),
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id),
  itemType: text('item_type').notNull(),
  itemId: uuid('item_id').notNull(),
  position: integer('position'),
  addedAt: ts('added_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
});

export const tags = pgTable('tags', {
  id: uuid('id').primaryKey(),
  scope: text('scope').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  /** System tags group by namespace (e.g. `type`, `terrain`); user tags leave null. */
  namespace: text('namespace'),
  label: text('label').notNull(),
  colour: text('colour'),
  icon: text('icon'),
  /** Soft-retire — still visible to owner; blocks new taggings. */
  retiredAt: ts('retired_at'),
});

export const taggings = pgTable('taggings', {
  id: uuid('id').primaryKey(),
  tagId: uuid('tag_id')
    .notNull()
    .references(() => tags.id),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  createdAt: ts('created_at').notNull(),
  deletedAt: ts('deleted_at'),
  /** Copied from Tag at assign time for chip display without leaking Tag rows. */
  tagLabel: text('tag_label').notNull(),
  tagColour: text('tag_colour'),
  tagScope: text('tag_scope').notNull(),
  tagNamespace: text('tag_namespace'),
});

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  body: text('body'),
  visitedAt: ts('visited_at'),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
});

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  body: text('body').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
});

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  sha256: text('sha256'),
  storageKey: text('storage_key'),
  contentType: text('content_type').notNull(),
  byteSize: integer('byte_size'),
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  uploadState: text('upload_state').notNull(),
  createdAt: ts('created_at').notNull(),
  updatedAt: ts('updated_at').notNull(),
  deletedAt: ts('deleted_at'),
});

export const shares = pgTable(
  'shares',
  {
    id: uuid('id').primaryKey(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id').notNull(),
    granteeUserId: uuid('grantee_user_id')
      .notNull()
      .references(() => users.id),
    permission: text('permission').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('shares_resource_idx').on(t.resourceType, t.resourceId)],
);

export const invites = pgTable('invites', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  permission: text('permission').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
});

export const publicLinks = pgTable('public_links', {
  id: uuid('id').primaryKey(),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  permission: text('permission').notNull().default('view'),
  expiresAt: ts('expires_at'),
  revokedAt: ts('revoked_at'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
});

/**
 * Append-only sync log. `server_seq` is the cursor watermark (DESIGN §5).
 */
export const changeLog = pgTable(
  'change_log',
  {
    serverSeq: bigserial('server_seq', { mode: 'number' }).primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    op: text('op').notNull(),
    payload: jsonb('payload'),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    deviceId: uuid('device_id').notNull(),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('change_log_seq_idx').on(t.serverSeq)],
);

/** Push idempotency — replay stored responses verbatim (DESIGN §5). */
export const syncPushReceipts = pgTable('sync_push_receipts', {
  pushId: uuid('push_id').primaryKey(),
  responseJson: jsonb('response_json').notNull(),
  createdAt: ts('created_at').notNull(),
});

/** Session / refresh tokens — hashed at rest (DESIGN §4 / §10). */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    deviceId: uuid('device_id').notNull(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Password-reset tokens — hashed at rest; short TTL (DESIGN §7 / §10). */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);
