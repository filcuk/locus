import { appSchema, tableSchema } from '@nozbe/watermelondb';

/**
 * Client schema mirrors DESIGN §4 entity fields as string | number | boolean
 * columns only (WatermelonDB constraint). There are no foreign-key constraints —
 * containment and parent integrity are enforced in application code
 * (`containment.ts`).
 *
 * `geom_geojson` is a serialised GeoJSON string, not a structured column.
 *
 * Timestamps (`created_at`, `updated_at`, …) are Unix milliseconds (`number`) —
 * WatermelonDB requires `created_at` / `updated_at` to be non-optional numbers.
 *
 * Server-only tables (ChangeLog, Session/RefreshToken password material) are
 * intentionally omitted from the local store.
 */
export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'email', type: 'string' },
        { name: 'email_verified_at', type: 'number', isOptional: true },
        { name: 'display_name', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'areas',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        // Spike: serialised Polygon | MultiPolygon GeoJSON (string only).
        { name: 'geom_geojson', type: 'string' },
        { name: 'bbox_min_lat', type: 'number' },
        { name: 'bbox_min_lon', type: 'number' },
        { name: 'bbox_max_lat', type: 'number' },
        { name: 'bbox_max_lon', type: 'number' },
        { name: 'visibility', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'updated_by', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'places',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'area_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lon', type: 'number', isOptional: true },
        { name: 'elevation_m', type: 'number', isOptional: true },
        { name: 'position_source', type: 'string', isOptional: true },
        { name: 'visibility', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'updated_by', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'points',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        // At most one of place_id / area_id — enforced in app code, not SQLite FK/CHECK.
        { name: 'place_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'area_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'lat', type: 'number' },
        { name: 'lon', type: 'number' },
        { name: 'elevation_m', type: 'number', isOptional: true },
        { name: 'position_source', type: 'string', isOptional: true },
        { name: 'feature_kind', type: 'string', isOptional: true },
        { name: 'recorded_at', type: 'number', isOptional: true },
        { name: 'visibility', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'updated_by', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'collections',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'visibility', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'updated_by', type: 'string' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'collection_items',
      columns: [
        { name: 'collection_id', type: 'string', isIndexed: true },
        { name: 'item_type', type: 'string' },
        { name: 'item_id', type: 'string', isIndexed: true },
        { name: 'position', type: 'number', isOptional: true },
        { name: 'added_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'tags',
      columns: [
        { name: 'scope', type: 'string' },
        { name: 'owner_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'label', type: 'string' },
        { name: 'colour', type: 'string', isOptional: true },
        { name: 'icon', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'taggings',
      columns: [
        { name: 'tag_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'notes',
      columns: [
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string', isOptional: true },
        { name: 'visited_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'comments',
      columns: [
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'body', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'photos',
      columns: [
        { name: 'owner_id', type: 'string', isIndexed: true },
        { name: 'target_type', type: 'string' },
        { name: 'target_id', type: 'string', isIndexed: true },
        { name: 'sha256', type: 'string', isOptional: true },
        { name: 'storage_key', type: 'string', isOptional: true },
        { name: 'content_type', type: 'string' },
        { name: 'byte_size', type: 'number', isOptional: true },
        { name: 'width', type: 'number', isOptional: true },
        { name: 'height', type: 'number', isOptional: true },
        { name: 'caption', type: 'string', isOptional: true },
        { name: 'upload_state', type: 'string' },
        // Client-only; never synced (DESIGN §4 Photos).
        { name: 'local_file_path', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'shares',
      columns: [
        { name: 'resource_type', type: 'string' },
        { name: 'resource_id', type: 'string', isIndexed: true },
        { name: 'grantee_user_id', type: 'string', isIndexed: true },
        { name: 'permission', type: 'string' },
        { name: 'created_by', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'invites',
      columns: [
        { name: 'email', type: 'string' },
        { name: 'resource_type', type: 'string' },
        { name: 'resource_id', type: 'string', isIndexed: true },
        { name: 'permission', type: 'string' },
        { name: 'token_hash', type: 'string' },
        { name: 'expires_at', type: 'number' },
        { name: 'created_by', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'public_links',
      columns: [
        { name: 'resource_type', type: 'string' },
        { name: 'resource_id', type: 'string', isIndexed: true },
        { name: 'token_hash', type: 'string' },
        { name: 'permission', type: 'string' },
        { name: 'expires_at', type: 'number', isOptional: true },
        { name: 'revoked_at', type: 'number', isOptional: true },
        { name: 'created_by', type: 'string' },
      ],
    }),
  ],
});
