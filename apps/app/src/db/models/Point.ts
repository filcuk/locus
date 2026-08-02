import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, relation, readonly, text } from '@nozbe/watermelondb/decorators';

import type Area from './Area';
import type Place from './Place';

export default class Point extends Model {
  static override table = 'points';
  static override associations = {
    places: { type: 'belongs_to' as const, key: 'place_id' },
    areas: { type: 'belongs_to' as const, key: 'area_id' },
  };

  @text('owner_id') ownerId!: string;
  @text('place_id') placeId!: string | null;
  @text('area_id') areaId!: string | null;
  @text('title') title!: string;
  @text('description') description!: string | null;
  @field('lat') lat!: number;
  @field('lon') lon!: number;
  @field('elevation_m') elevationM!: number | null;
  @text('position_source') positionSource!: string | null;
  @text('feature_kind') featureKind!: string | null;
  @date('recorded_at') recordedAt!: Date | null;
  @text('visibility') visibility!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @text('updated_by') updatedBy!: string;
  @date('deleted_at') deletedAt!: Date | null;

  @relation('places', 'place_id') place!: Relation<Place>;
  @relation('areas', 'area_id') area!: Relation<Area>;
}
