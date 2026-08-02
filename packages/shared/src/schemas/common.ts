import { z } from 'zod';

/** Client-generated primary keys (UUIDv7 preferred; v4 accepted). */
export const UuidSchema = z.uuid();

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });

export const VisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type Visibility = z.infer<typeof VisibilitySchema>;

export const PositionSourceSchema = z.enum(['manual', 'map', 'gps']);
export type PositionSource = z.infer<typeof PositionSourceSchema>;

export const SharePermissionSchema = z.enum(['view', 'comment', 'edit']);
export type SharePermission = z.infer<typeof SharePermissionSchema>;

export const ResourceTypeSchema = z.enum(['area', 'place', 'point', 'collection']);
export type ResourceType = z.infer<typeof ResourceTypeSchema>;

export const TargetTypeSchema = z.enum(['area', 'place', 'point', 'collection']);
export type TargetType = z.infer<typeof TargetTypeSchema>;

export const CollectionItemTypeSchema = z.enum(['area', 'place', 'point']);
export type CollectionItemType = z.infer<typeof CollectionItemTypeSchema>;

export const TagScopeSchema = z.enum(['system', 'user']);
export type TagScope = z.infer<typeof TagScopeSchema>;

export const UploadStateSchema = z.enum(['local_only', 'pending', 'uploaded', 'failed']);
export type UploadState = z.infer<typeof UploadStateSchema>;

export const LatitudeSchema = z.number().min(-90).max(90);
export const LongitudeSchema = z.number().min(-180).max(180);

/** WGS84 GeoJSON Polygon (closed rings). */
export const PolygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([LongitudeSchema, LatitudeSchema])).min(4)).min(1),
});

/** WGS84 GeoJSON MultiPolygon. */
export const MultiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z
    .array(z.array(z.array(z.tuple([LongitudeSchema, LatitudeSchema])).min(4)).min(1))
    .min(1),
});

export const AreaGeometrySchema = z.discriminatedUnion('type', [
  PolygonGeometrySchema,
  MultiPolygonGeometrySchema,
]);
export type AreaGeometry = z.infer<typeof AreaGeometrySchema>;
