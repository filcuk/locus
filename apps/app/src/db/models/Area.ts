import { Model, type Query } from '@nozbe/watermelondb';
import { children, date, field, readonly, text } from '@nozbe/watermelondb/decorators';

import type Place from './Place';
import type Point from './Point';

export default class Area extends Model {
  static override table = 'areas';
  static override associations = {
    places: { type: 'has_many' as const, foreignKey: 'area_id' },
    points: { type: 'has_many' as const, foreignKey: 'area_id' },
  };

  @text('owner_id') ownerId!: string;
  @text('title') title!: string;
  @text('description') description!: string | null;
  /** Serialised GeoJSON Polygon | MultiPolygon — string column only. */
  @text('geom_geojson') geomGeojson!: string;
  @field('bbox_min_lat') bboxMinLat!: number;
  @field('bbox_min_lon') bboxMinLon!: number;
  @field('bbox_max_lat') bboxMaxLat!: number;
  @field('bbox_max_lon') bboxMaxLon!: number;
  @text('visibility') visibility!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @text('updated_by') updatedBy!: string;
  @date('deleted_at') deletedAt!: Date | null;

  @children('places') places!: Query<Place>;
  @children('points') points!: Query<Point>;
}
