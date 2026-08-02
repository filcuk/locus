import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

/** Local profile row — never stores password_hash (server-only). */
export default class User extends Model {
  static override table = 'users';

  @text('email') email!: string;
  @date('email_verified_at') emailVerifiedAt!: Date | null;
  @text('display_name') displayName!: string;
  @readonly @date('created_at') createdAt!: Date;
}
