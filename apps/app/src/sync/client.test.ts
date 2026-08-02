import { describe, expect, it, vi } from 'vitest';

import { emptySyncChanges } from '@locus/shared';

import { clearServerUrl, setServerUrl } from '../config/server-url.js';
import { createAppSyncClient, createAuthedSyncFetch } from './client.js';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const TOKEN = 'test-access-token';

describe('createAppSyncClient', () => {
  it('requires a configured server URL', () => {
    clearServerUrl();
    expect(() =>
      createAppSyncClient({
        deviceId: DEVICE,
        getAccessToken: () => TOKEN,
      }),
    ).toThrow(/Server URL is not configured/);
  });

  it('binds pull/push to the configured server URL with Bearer auth', async () => {
    setServerUrl('https://locus.example');
    const fetchMock = vi.fn(async () =>
      Response.json({
        changes: emptySyncChanges(),
        timestamp: 0,
      }),
    );

    const client = createAppSyncClient({
      deviceId: DEVICE,
      getAccessToken: async () => TOKEN,
      fetch: fetchMock,
    });

    await client.pull(0);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers ?? {};
    expect(url).toContain('https://locus.example/sync/pull');
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(
      Object.keys(headers).some((k) => k.toLowerCase() === 'x-locus-user-id'),
    ).toBe(false);
    clearServerUrl();
  });

  it('keeps legacy X-Locus-User-Id only when userId is provided', async () => {
    setServerUrl('https://locus.example');
    const fetchMock = vi.fn(async () =>
      Response.json({ changes: emptySyncChanges(), timestamp: 1 }),
    );

    const client = createAppSyncClient({
      deviceId: DEVICE,
      userId: USER,
      getAccessToken: () => TOKEN,
      fetch: fetchMock,
    });

    await client.pull(0);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers ?? {};
    expect(headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['x-locus-user-id']).toBe(USER);
    clearServerUrl();
  });
});

describe('createAuthedSyncFetch', () => {
  it('throws when the token getter returns null', async () => {
    const fetchImpl = createAuthedSyncFetch({
      getAccessToken: () => null,
      fetch: async () => Response.json({}),
    });
    await expect(fetchImpl('https://locus.example/sync/pull')).rejects.toThrow(
      /access token/i,
    );
  });
});
