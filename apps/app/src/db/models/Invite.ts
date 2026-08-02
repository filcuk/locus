import { Model } from '@nozbe/watermelondb';
import { date, text } from '@nozbe/watermelondb/decorators';

export default class Invite extends Model {
  static override table = 'invites';

  @text('email') email!: string;
  @text('resource_type') resourceType!: string;
  @text('resource_id') resourceId!: string;
  @text('permission') permission!: string;
  @text('token_hash') tokenHash!: string;
  @date('expires_at') expiresAt!: Date;
  @text('created_by') createdBy!: string;
}
