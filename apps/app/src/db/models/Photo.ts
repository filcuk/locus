import { Model } from '@nozbe/watermelondb';
import { date, field, readonly, text } from '@nozbe/watermelondb/decorators';

export default class Photo extends Model {
  static override table = 'photos';

  @text('owner_id') ownerId!: string;
  @text('target_type') targetType!: string;
  @text('target_id') targetId!: string;
  @text('sha256') sha256!: string | null;
  @text('storage_key') storageKey!: string | null;
  @text('content_type') contentType!: string;
  @field('byte_size') byteSize!: number | null;
  @field('width') width!: number | null;
  @field('height') height!: number | null;
  @text('caption') caption!: string | null;
  @text('upload_state') uploadState!: string;
  /** Client-only; never synced (DESIGN §4 Photos). */
  @text('local_file_path') localFilePath!: string | null;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt!: Date | null;
}
