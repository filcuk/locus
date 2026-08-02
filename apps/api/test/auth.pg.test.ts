import type { AuthTokens } from '@locus/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import type { Mailer } from '../src/services/mailer.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const DEVICE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Auth API against Postgres (Testcontainers)', () => {
  let fx: PgFixture;
  const resetCapture: { token: string | undefined } = { token: undefined };
  const mailer: Mailer = {
    async sendPasswordReset(mail) {
      resetCapture.token = mail.resetToken;
    },
  };

  beforeAll(async () => {
    fx = await startPostgresFixture();
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  });

  function app() {
    return createApp(fx.handle, { mailer });
  }

  it('registers, logs in, refreshes, and logs out', async () => {
    const registerRes = await app().request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'Auth.User@Example.com',
        password: 'long-enough-password',
        display_name: 'Auth User',
        device_id: DEVICE_A,
      }),
    });
    expect(registerRes.status).toBe(201);
    const registered = (await registerRes.json()) as AuthTokens;
    expect(registered.token_type).toBe('Bearer');
    expect(registered.user.email).toBe('auth.user@example.com');
    expect(registered.access_token.length).toBeGreaterThan(10);
    expect(registered.refresh_token.length).toBeGreaterThan(10);

    const loginRes = await app().request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'auth.user@example.com',
        password: 'long-enough-password',
        device_id: DEVICE_A,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loggedIn = (await loginRes.json()) as AuthTokens;

    const refreshRes = await app().request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: loggedIn.refresh_token,
        device_id: DEVICE_A,
      }),
    });
    expect(refreshRes.status).toBe(200);
    const refreshed = (await refreshRes.json()) as AuthTokens;
    expect(refreshed.refresh_token).not.toBe(loggedIn.refresh_token);

    const replayRes = await app().request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: loggedIn.refresh_token,
        device_id: DEVICE_A,
      }),
    });
    expect(replayRes.status).toBe(401);

    const wrongDevice = await app().request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshed.refresh_token,
        device_id: DEVICE_B,
      }),
    });
    expect(wrongDevice.status).toBe(401);

    const logoutRes = await app().request('/auth/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshed.refresh_token }),
    });
    expect(logoutRes.status).toBe(200);

    const afterLogout = await app().request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: refreshed.refresh_token,
        device_id: DEVICE_A,
      }),
    });
    expect(afterLogout.status).toBe(401);
  });

  it('rejects bad passwords and duplicate emails', async () => {
    const bad = await app().request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'auth.user@example.com',
        password: 'not-the-password',
        device_id: DEVICE_A,
      }),
    });
    expect(bad.status).toBe(401);

    const dup = await app().request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'auth.user@example.com',
        password: 'another-long-password',
        display_name: 'Other',
        device_id: DEVICE_A,
      }),
    });
    expect(dup.status).toBe(409);
  });

  it('resets password via stub mailer and revokes sessions', async () => {
    resetCapture.token = undefined;
    const email = 'reset.user@example.com';
    const oldPassword = 'long-enough-password';

    const registerRes = await app().request('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: oldPassword,
        display_name: 'Reset User',
        device_id: DEVICE_A,
      }),
    });
    expect(registerRes.status).toBe(201);
    const session = (await registerRes.json()) as AuthTokens;

    const reqRes = await app().request('/auth/password-reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(reqRes.status).toBe(200);
    if (resetCapture.token === undefined) {
      throw new Error('expected password-reset mailer to capture a token');
    }
    const capturedToken: string = resetCapture.token;

    const confirmRes = await app().request('/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: capturedToken,
        password: 'brand-new-password',
      }),
    });
    expect(confirmRes.status).toBe(200);

    const oldRefresh = await app().request('/auth/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        refresh_token: session.refresh_token,
        device_id: DEVICE_A,
      }),
    });
    expect(oldRefresh.status).toBe(401);

    const oldLogin = await app().request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: oldPassword,
        device_id: DEVICE_A,
      }),
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await app().request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'brand-new-password',
        device_id: DEVICE_A,
      }),
    });
    expect(newLogin.status).toBe(200);
  });

  it('does not enumerate emails on reset request', async () => {
    resetCapture.token = undefined;
    const res = await app().request('/auth/password-reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(resetCapture.token).toBeUndefined();
  });
});
