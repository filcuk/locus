import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export default class Share extends Model {
  static override table = 'shares';

  @text('resource_type') resourceType!: string;
  @text('resource_id') resourceId!: string;
  @text('grantee_user_id') granteeUserId!: string;
  @text('permission') permission!: string;
  @text('created_by') createdBy!: string;
  @readonly @date('created_at') createdAt!: Date;
}
