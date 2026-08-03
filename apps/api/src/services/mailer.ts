import { env } from '../env.js';

export type PasswordResetMail = {
  /** Recipient — never log this value. */
  to: string;
  resetToken: string;
  resetUrl: string;
};

export type InviteMail = {
  /** Recipient — never log this value. */
  to: string;
  inviteToken: string;
  inviteUrl: string;
};

export type Mailer = {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
  sendInvite(mail: InviteMail): Promise<void>;
};

/**
 * Documented stub path (P1-A): never emails tokens; never logs email or token
 * (DESIGN §10). When `SMTP_HOST` is set we only note that a transport is still
 * unwired — a licensed SMTP library needs its own decision before it lands.
 * Tests inject a capturing mailer.
 */
export function createMailer(): Mailer {
  return {
    async sendPasswordReset() {
      console.log(
        JSON.stringify({
          msg: 'password_reset_stub',
          smtp_configured: Boolean(env().SMTP_HOST),
          note: 'reset token not emailed; capture via injected mailer in tests',
        }),
      );
    },
    async sendInvite() {
      console.log(
        JSON.stringify({
          msg: 'invite_stub',
          smtp_configured: Boolean(env().SMTP_HOST),
          note: 'invite token not emailed; capture via injected mailer in tests',
        }),
      );
    },
  };
}
