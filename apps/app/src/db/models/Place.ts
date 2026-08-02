import { Model, type Query, type Relation } from '@nozbe/watermelondb';
import { children, date, field, relation, readonly, text } from '@nozbe/watermelondb/decorators';

import type Area from './Area';
import type Point from './Point';

export default class Place extends Model {
  static override table = 'places';
  static override associations = {
    areas: { type: 'belongs_to' as const, key: 'area_id' },
    points: { type: 'has_many' as const, foreignKey: 'place_id' },
  };

  @text('owner_id') ownerId!: string;
  @text('area_id') areaId!: string | null;
  @text('title') title!: string;
  @text('description') description!: string | null;
  @field('lat') lat!: number | null;
  @field('lon') lon!: number | null;
  @field('elevation_m') elevationM!: number | null;
  @text('position_source') positionSource!: string | null;
  @text('visibility') visibility!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @text('updated_by') updatedBy!: string;
  @date('deleted_at') deletedAt!: Date | null;

  @relation('areas', 'area_id') area!: Relation<Area>;
  @children('points') points!: Query<Point>;
}
