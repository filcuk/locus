import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export default class Note extends Model {
  static override table = 'notes';

  @text('author_id') authorId!: string;
  @text('target_type') targetType!: string;
  @text('target_id') targetId!: string;
  @text('body') body!: string | null;
  @date('visited_at') visitedAt!: Date | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt!: Date | null;
}
