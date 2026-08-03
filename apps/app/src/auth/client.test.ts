import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearServerUrl, setServerUrl } from '../config/server-url.js';
import {
  AuthHttpError,
  clearDeviceIdForTests,
  createMemorySecureStorage,
  getAccessToken,
  getValidAccessToken,
  login,
  refreshAccessToken,
  register,
  requestPasswordReset,
  setAuthFetchForTests,
  setSecureStorageForTests,
  clearSession,
  hasSession,
} from './index.js';

const DEVICE = '018f0000-0000-7000-8000-0000000000aa';

function tokens(overrides?: Partial<{ access: string; refresh: string }>) {
  return {
    access_token: overrides?.access ?? 'access-1',
    refresh_token: overrides?.refresh ?? 'refresh-1',
    token_type: 'Bearer' as const,
    expires_in: 3600,
    user: {
      id: '018f0000-0000-7000-8000-0000000000bb',
      email: 'user@example.com',
      display_name: 'User',
    },
  };
}

beforeEach(async () => {
  setSecureStorageForTests(createMemorySecureStorage());
  await setServerUrl('https://locus.example.com');
  setAuthFetchForTests(null);
  await clearSession();
  await clearDeviceIdForTests();
});

afterEach(async () => {
  setAuthFetchForTests(null);
  await clearServerUrl();
  setSecureStorageForTests(null);
});

describe('auth client', () => {
  it('registers and persists tokens without wiping anything on success', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(tokens(), { status: 201 }),
    );
    setAuthFetchForTests(fetchMock);

    const result = await register({
      email: 'user@example.com',
      password: 'long-enough-password',
      display_name: 'User',
    });

    expect(result.access_token).toBe('access-1');
    expect(await hasSession()).toBe(true);
    expect(await getAccessToken()).toBe('access-1');
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      device_id: string;
    };
    expect(body.device_id.length).toBeGreaterThan(10);
  });

  it('logs in against the configured server URL', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('https://locus.example.com/auth/login');
      return Response.json(tokens());
    });
    setAuthFetchForTests(fetchMock);

    await login({ email: 'user@example.com', password: 'long-enough-password' });
    expect(await getAccessToken()).toBe('access-1');
  });

  it('requests password reset', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    setAuthFetchForTests(fetchMock);

    await requestPasswordReset({ email: 'user@example.com' });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/auth/password-reset/request',
    );
  });

  it('single-flights concurrent refresh calls', async () => {
    const storage = createMemorySecureStorage();
    setSecureStorageForTests(storage);
    await storage.setItem('locus.deviceId', DEVICE);
    await storage.setItem('locus.accessToken', 'old-access');
    await storage.setItem('locus.refreshToken', 'refresh-1');
    await storage.setItem('locus.accessExpiresAt', String(Date.now() - 1_000));
    await storage.setItem(
      'locus.authUser',
      JSON.stringify(tokens().user),
    );

    let refreshCalls = 0;
    let release!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });

    setAuthFetchForTests(async (url) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return gate;
      }
      throw new Error(`unexpected ${url}`);
    });

    const a = refreshAccessToken();
    const b = refreshAccessToken();
    release(
      Response.json(tokens({ access: 'access-2', refresh: 'refresh-2' })),
    );
    expect(await a).toBe('access-2');
    expect(await b).toBe('access-2');
    expect(refreshCalls).toBe(1);
    expect(await getAccessToken()).toBe('access-2');
  });

  it('clears tokens on invalid refresh but never claims a DB wipe path', async () => {
    const storage = createMemorySecureStorage();
    setSecureStorageForTests(storage);
    await storage.setItem('locus.deviceId', DEVICE);
    await storage.setItem('locus.accessToken', 'old-access');
    await storage.setItem('locus.refreshToken', 'refresh-1');
    await storage.setItem('locus.accessExpiresAt', String(Date.now() - 1_000));
    await storage.setItem(
      'locus.authUser',
      JSON.stringify(tokens().user),
    );

    setAuthFetchForTests(async () =>
      Response.json({ error: 'invalid_refresh' }, { status: 401 }),
    );

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(await hasSession()).toBe(false);
    expect(await getAccessToken()).toBeNull();
    // device_id survives — reinstall semantics, not logout wipe of local DB.
    expect(await storage.getItem('locus.deviceId')).toBe(DEVICE);
  });

  it('getValidAccessToken refreshes a stale access token', async () => {
    const storage = createMemorySecureStorage();
    setSecureStorageForTests(storage);
    await storage.setItem('locus.deviceId', DEVICE);
    await storage.setItem('locus.accessToken', 'old-access');
    await storage.setItem('locus.refreshToken', 'refresh-1');
    await storage.setItem('locus.accessExpiresAt', String(Date.now() - 1_000));
    await storage.setItem(
      'locus.authUser',
      JSON.stringify(tokens().user),
    );

    setAuthFetchForTests(async () =>
      Response.json(tokens({ access: 'fresh-access', refresh: 'refresh-2' })),
    );

    await expect(getValidAccessToken()).resolves.toBe('fresh-access');
  });

  it('surfaces AuthHttpError on 429', async () => {
    setAuthFetchForTests(async () =>
      Response.json({ error: 'rate_limited' }, { status: 429 }),
    );
    await expect(
      login({ email: 'user@example.com', password: 'x' }),
    ).rejects.toMatchObject({
      name: 'AuthHttpError',
      status: 429,
      code: 'rate_limited',
    } satisfies Partial<AuthHttpError>);
  });
});
