import { Model, type Relation } from '@nozbe/watermelondb';
import { date, relation, readonly, text } from '@nozbe/watermelondb/decorators';

import type Tag from './Tag';

export default class Tagging extends Model {
  static override table = 'taggings';
  static override associations = {
    tags: { type: 'belongs_to' as const, key: 'tag_id' },
  };

  @text('tag_id') tagId!: string;
  @text('target_type') targetType!: string;
  @text('target_id') targetId!: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('deleted_at') deletedAt!: Date | null;
  @text('tag_label') tagLabel!: string;
  @text('tag_colour') tagColour!: string | null;
  @text('tag_scope') tagScope!: string;
  @text('tag_namespace') tagNamespace!: string | null;

  @relation('tags', 'tag_id') tag!: Relation<Tag>;
}
