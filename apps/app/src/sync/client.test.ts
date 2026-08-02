import { describe, expect, it, vi } from 'vitest';

import { clearServerUrl, setServerUrl } from '../config/server-url.js';
import { createAppSyncClient } from './client.js';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';

describe('createAppSyncClient', () => {
  it('requires a configured server URL', () => {
    clearServerUrl();
    expect(() =>
      createAppSyncClient({ userId: USER, deviceId: DEVICE }),
    ).toThrow(/Server URL is not configured/);
  });

  it('binds pull/push to the configured server URL', async () => {
    setServerUrl('https://locus.example');
    const fetchMock = vi.fn(async () =>
      Response.json({
        changes: {
          areas: { created: [], updated: [], deleted: [] },
          places: { created: [], updated: [], deleted: [] },
          points: { created: [], updated: [], deleted: [] },
          collections: { created: [], updated: [], deleted: [] },
          collection_items: { created: [], updated: [], deleted: [] },
          tags: { created: [], updated: [], deleted: [] },
          taggings: { created: [], updated: [], deleted: [] },
          notes: { created: [], updated: [], deleted: [] },
          comments: { created: [], updated: [], deleted: [] },
          photos: { created: [], updated: [], deleted: [] },
          shares: { created: [], updated: [], deleted: [] },
        },
        timestamp: 0,
      }),
    );

    const client = createAppSyncClient({
      userId: USER,
      deviceId: DEVICE,
      fetch: fetchMock,
    });

    await client.pull(0);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'https://locus.example/sync/pull',
    );
    clearServerUrl();
  });
});
