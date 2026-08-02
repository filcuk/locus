import { Model } from '@nozbe/watermelondb';
import { date, text } from '@nozbe/watermelondb/decorators';

export default class PublicLink extends Model {
  static override table = 'public_links';

  @text('resource_type') resourceType!: string;
  @text('resource_id') resourceId!: string;
  @text('token_hash') tokenHash!: string;
  @text('permission') permission!: string;
  @date('expires_at') expiresAt!: Date | null;
  @date('revoked_at') revokedAt!: Date | null;
  @text('created_by') createdBy!: string;
}
