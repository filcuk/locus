/**
 * I1 proof: shared sync HTTP client (used by `apps/app/src/sync`) against the
 * real API over Testcontainers Postgres — push from device A, pull on device B,
 * and confirm `timestamp` is a usable server_seq cursor (DESIGN §5 / §11).
 *
 * Gaps (honest): WatermelonDB `synchronize()` local apply/merge is not wired;
 * auth is still the temporary `X-Locus-*` headers.
 */

import {
  createSyncClient,
  proveSyncRoundTrip,
  type SyncFetch,
} from '@locus/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/index.js';
import { users } from '../src/db/schema.js';
import { getReadableWatermark } from '../src/services/changeLog.js';
import { startPostgresFixture, stopPostgresFixture, type PgFixture } from './pg.js';

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_A = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const DEVICE_B = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';
const PLACE = 'f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1';
const PUSH_ID = '41414141-4141-4141-8141-414141414141';
const NOW = new Date().toISOString();
const BASE = 'http://locus.test';

describe('client sync transport ↔ API round-trip (Testcontainers)', () => {
  let fx: PgFixture;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fx = await startPostgresFixture();
    app = createApp(fx.handle);
    await fx.handle.db.insert(users).values({
      id: OWNER,
      email: 'roundtrip@example.com',
      displayName: 'Roundtrip',
      passwordHash: 'x',
      createdAt: NOW,
    });
  }, 120_000);

  afterAll(async () => {
    await stopPostgresFixture(fx);
  }, 60_000);

  function honoFetch(userId: string, deviceId: string): SyncFetch {
    return async (input, init) => {
      const url = new URL(input, BASE);
      const headers = new Headers(init?.headers);
      headers.set('x-locus-user-id', userId);
      headers.set('x-locus-device-id', deviceId);
      return app.request(`${url.pathname}${url.search}`, {
        method: init?.method,
        headers,
        body: init?.body,
      });
    };
  }

  it('push via sync client, pull on another device, cursor advances', async () => {
    const writer = createSyncClient({
      baseUrl: BASE,
      userId: OWNER,
      deviceId: DEVICE_A,
      fetch: honoFetch(OWNER, DEVICE_A),
    });
    const reader = createSyncClient({
      baseUrl: BASE,
      userId: OWNER,
      deviceId: DEVICE_B,
      fetch: honoFetch(OWNER, DEVICE_B),
    });

    const { push, pull, lastPulledAt } = await proveSyncRoundTrip({
      writer,
      reader,
      pushId: PUSH_ID,
      changes: {
        places: {
          created: [
            {
              id: PLACE,
              owner_id: OWNER,
              title: 'Client round-trip place',
              visibility: 'private',
              created_at: NOW,
              updated_at: NOW,
              updated_by: OWNER,
            },
          ],
          updated: [],
          deleted: [],
        },
      },
    });

    expect(push.applied).toBe(1);
    expect(lastPulledAt).toBeGreaterThan(0);
    expect(await getReadableWatermark(fx.handle.db)).toBe(lastPulledAt);
    expect(pull.timestamp).toBe(lastPulledAt);
    expect(pull.changes.places.created.some((p) => p.id === PLACE)).toBe(true);

    // Incremental pull at the watermark sees nothing new (cursor = server_seq).
    const incremental = await reader.pull(lastPulledAt);
    expect(incremental.changes.places.created).toHaveLength(0);
    expect(incremental.timestamp).toBe(lastPulledAt);
  });
});
