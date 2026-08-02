import {
  AuthTokensSchema,
  LoginRequestSchema,
  LogoutRequestSchema,
  OkResponseSchema,
  PasswordResetConfirmSchema,
  PasswordResetRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  newEntityId,
} from '@locus/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import type { DbHandle } from '../db/client.js';
import { users } from '../db/schema.js';
import { issueAccessToken } from '../services/accessToken.js';
import type { Mailer } from '../services/mailer.js';
import { hashPassword, verifyPassword } from '../services/password.js';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '../services/passwordReset.js';
import { createRateLimiter } from '../services/rateLimit.js';
import {
  createSession,
  revokeSessionByRefreshToken,
  rotateSession,
} from '../services/sessions.js';

export type AuthRouteDeps = {
  mailer: Mailer;
  now?: () => Date;
};

function clientKey(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function createAuthRoutes(handle: DbHandle, deps: AuthRouteDeps) {
  const app = new Hono();
  const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
  const now = () => deps.now?.() ?? new Date();

  app.use('/auth/*', async (c, next) => {
    if (!limiter.allow(clientKey(c))) {
      return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
  });

  app.post('/auth/register', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RegisterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await handle.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing[0]) {
      return c.json({ error: 'email_taken' }, 409);
    }

    const userId = newEntityId();
    const createdAt = now().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);

    await handle.db.insert(users).values({
      id: userId,
      email,
      displayName: parsed.data.display_name,
      passwordHash,
      createdAt,
      emailVerifiedAt: null,
    });

    const session = await createSession(handle.db, {
      userId,
      deviceId: parsed.data.device_id,
      now: now(),
    });
    const access = await issueAccessToken(userId, now());

    const payload = AuthTokensSchema.parse({
      access_token: access.token,
      refresh_token: session.refreshToken,
      token_type: 'Bearer',
      expires_in: access.expiresIn,
      user: {
        id: userId,
        email,
        display_name: parsed.data.display_name,
      },
    });
    return c.json(payload, 201);
  });

  app.post('/auth/login', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LoginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    const email = parsed.data.email.trim().toLowerCase();
    const found = await handle.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user = found[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }

    const session = await createSession(handle.db, {
      userId: user.id,
      deviceId: parsed.data.device_id,
      now: now(),
    });
    const access = await issueAccessToken(user.id, now());

    return c.json(
      AuthTokensSchema.parse({
        access_token: access.token,
        refresh_token: session.refreshToken,
        token_type: 'Bearer',
        expires_in: access.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
        },
      }),
    );
  });

  app.post('/auth/refresh', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = RefreshRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    const rotated = await rotateSession(handle.db, {
      refreshToken: parsed.data.refresh_token,
      deviceId: parsed.data.device_id,
      now: now(),
    });
    if (!rotated) {
      return c.json({ error: 'invalid_refresh' }, 401);
    }

    const userRows = await handle.db
      .select()
      .from(users)
      .where(eq(users.id, rotated.userId))
      .limit(1);
    const user = userRows[0];
    if (!user) {
      return c.json({ error: 'invalid_refresh' }, 401);
    }

    const access = await issueAccessToken(user.id, now());
    return c.json(
      AuthTokensSchema.parse({
        access_token: access.token,
        refresh_token: rotated.session.refreshToken,
        token_type: 'Bearer',
        expires_in: access.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
        },
      }),
    );
  });

  app.post('/auth/logout', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = LogoutRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    await revokeSessionByRefreshToken(handle.db, parsed.data.refresh_token, now());
    return c.json(OkResponseSchema.parse({ ok: true }));
  });

  app.post('/auth/password-reset/request', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PasswordResetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    try {
      await requestPasswordReset(handle.db, deps.mailer, parsed.data.email, now());
    } catch {
      // Do not reveal mailer / account state to the client.
      return c.json({ error: 'reset_unavailable' }, 503);
    }
    return c.json(OkResponseSchema.parse({ ok: true }));
  });

  app.post('/auth/password-reset/confirm', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PasswordResetConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'validation_failed', message: parsed.error.message }, 400);
    }

    const ok = await confirmPasswordReset(handle.db, {
      token: parsed.data.token,
      password: parsed.data.password,
      now: now(),
    });
    if (!ok) {
      return c.json({ error: 'invalid_reset_token' }, 400);
    }
    return c.json(OkResponseSchema.parse({ ok: true }));
  });

  return app;
}
