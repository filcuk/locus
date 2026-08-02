import { Model, type Query } from '@nozbe/watermelondb';
import { children, date, readonly, text } from '@nozbe/watermelondb/decorators';

import type CollectionItem from './CollectionItem';

export default class Collection extends Model {
  static override table = 'collections';
  static override associations = {
    collection_items: { type: 'has_many' as const, foreignKey: 'collection_id' },
  };

  @text('owner_id') ownerId!: string;
  @text('title') title!: string;
  @text('description') description!: string | null;
  @text('visibility') visibility!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @text('updated_by') updatedBy!: string;
  @date('deleted_at') deletedAt!: Date | null;

  @children('collection_items') items!: Query<CollectionItem>;
}
