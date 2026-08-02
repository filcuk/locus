import { Model, type Query } from '@nozbe/watermelondb';
import { children, text } from '@nozbe/watermelondb/decorators';

import type Tagging from './Tagging';

export default class Tag extends Model {
  static override table = 'tags';
  static override associations = {
    taggings: { type: 'has_many' as const, foreignKey: 'tag_id' },
  };

  @text('scope') scope!: string;
  @text('owner_id') ownerId!: string | null;
  @text('label') label!: string;
  @text('colour') colour!: string | null;
  @text('icon') icon!: string | null;

  @children('taggings') taggings!: Query<Tagging>;
}
