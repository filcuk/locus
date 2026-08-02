import { Model, type Relation } from '@nozbe/watermelondb';
import { date, field, relation, text } from '@nozbe/watermelondb/decorators';

import type Collection from './Collection';

export default class CollectionItem extends Model {
  static override table = 'collection_items';
  static override associations = {
    collections: { type: 'belongs_to' as const, key: 'collection_id' },
  };

  @text('collection_id') collectionId!: string;
  @text('item_type') itemType!: string;
  @text('item_id') itemId!: string;
  @field('position') position!: number | null;
  @date('added_at') addedAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt!: Date | null;

  /** Named to avoid clashing with Model.collection. */
  @relation('collections', 'collection_id') parentCollection!: Relation<Collection>;
}
