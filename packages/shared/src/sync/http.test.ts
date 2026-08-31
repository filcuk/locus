import { describe, expect, it, vi } from 'vitest';

import { newEntityId } from '../ids.js';
import { emptySyncChanges } from '../schemas/sync.js';
import {
  SyncCancelledError,
  SyncHttpError,
  createSyncClient,
  proveSyncRoundTrip,
  type SyncFetch,
} from './http.js';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE_A = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const DEVICE_B = 'd2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2';
const PLACE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const NOW = '2026-08-02T12:00:00.000Z';

function placeRow() {
  return {
    id: PLACE,
    owner_id: USER,
    title: 'Round-trip place',
    visibility: 'private' as const,
    created_at: NOW,
    updated_at: NOW,
    updated_by: USER,
  };
}

describe('sync HTTP client (DESIGN §5 wire)', () => {
  it('pull parses a full empty changes bag and treats timestamp as cursor', async () => {
    const fetchMock = vi.fn<SyncFetch>(async () =>
      Response.json({
        changes: emptySyncChanges(),
        timestamp: 42,
      }),
    );

    const client = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      fetch: fetchMock,
    });

    const pulled = await client.pull(0);
    expect(pulled.timestamp).toBe(42);
    expect(pulled.changes.places.created).toEqual([]);

    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('/sync/pull?');
    expect(calledUrl).toContain('cursor=0');
    expect(calledUrl).toContain('schema_version=1');
  });

  it('push sends shared-schema body and returns applied watermark', async () => {
    const fetchMock = vi.fn<SyncFetch>(async () =>
      Response.json({ applied: 1, timestamp: 7, rejected: [] }),
    );

    const client = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      fetch: fetchMock,
    });

    const pushId = newEntityId();
    const result = await client.push({
      push_id: pushId,
      cursor: 0,
      changes: {
        places: { created: [placeRow()], updated: [], deleted: [] },
      },
    });

    expect(result.applied).toBe(1);
    expect(result.timestamp).toBe(7);

    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as {
      push_id: string;
      device_id: string;
    };
    expect(body.push_id).toBe(pushId);
    expect(body.device_id).toBe(DEVICE_A);
  });

  it('surfaces PULL_REQUIRED as SyncHttpError with status 409', async () => {
    const client = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      fetch: async () =>
        Response.json(
          { code: 'PULL_REQUIRED', message: 'Pull and rebase before pushing' },
          { status: 409 },
        ),
    });

    await expect(
      client.push({
        push_id: newEntityId(),
        cursor: 0,
        changes: {},
      }),
    ).rejects.toMatchObject({
      name: 'SyncHttpError',
      status: 409,
      code: 'PULL_REQUIRED',
    } satisfies Partial<SyncHttpError>);
  });

  it('proveSyncRoundTrip threads server_seq as lastPulledAt', async () => {
    let writerPulls = 0;
    const writerFetch: SyncFetch = async (input) => {
      if (input.includes('/sync/pull')) {
        writerPulls += 1;
        return Response.json({
          changes: emptySyncChanges(),
          timestamp: writerPulls === 1 ? 0 : 5,
        });
      }
      return Response.json({ applied: 1, timestamp: 5, rejected: [] });
    };

    const readerFetch: SyncFetch = async () => {
      const changes = emptySyncChanges();
      changes.places.created.push(placeRow());
      return Response.json({ changes, timestamp: 5 });
    };

    const writer = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      fetch: writerFetch,
    });
    const reader = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_B,
      fetch: readerFetch,
    });

    const result = await proveSyncRoundTrip({
      writer,
      reader,
      pushId: newEntityId(),
      changes: {
        places: { created: [placeRow()], updated: [], deleted: [] },
      },
    });

    expect(result.push.applied).toBe(1);
    expect(result.lastPulledAt).toBe(5);
    expect(result.pull.changes.places.created.some((p) => p.id === PLACE)).toBe(
      true,
    );
  });

  it('retries transient transport responses with bounded backoff', async () => {
    const sleeps: number[] = [];
    let calls = 0;
    const client = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      fetch: async () => {
        calls += 1;
        if (calls < 3) {
          return Response.json({ message: 'temporary failure' }, { status: 503 });
        }
        return Response.json({ changes: emptySyncChanges(), timestamp: 4 });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    await expect(client.pull(0)).resolves.toMatchObject({ timestamp: 4 });
    expect(calls).toBe(3);
    expect(sleeps).toEqual([500, 1_000]);
  });

  it('cancels a transport attempt without retrying', async () => {
    const controller = new AbortController();
    const sleeps: number[] = [];
    let calls = 0;
    const client = createSyncClient({
      baseUrl: 'https://locus.example',
      userId: USER,
      deviceId: DEVICE_A,
      signal: controller.signal,
      fetch: async (_input, init) => {
        calls += 1;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const request = client.pull(0);
    controller.abort();

    await expect(request).rejects.toBeInstanceOf(SyncCancelledError);
    expect(calls).toBe(1);
    expect(sleeps).toEqual([]);
  });
});
