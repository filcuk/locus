import { SyncErrorCodes, SyncHttpError, emptySyncChanges } from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bindSyncStatusHooks,
  silenceSyncStatusHooks,
  type SyncStatusHooks,
} from './status';
import { runSynchronize } from './synchronize';

const DEVICE = 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1';
const TOKEN = 'token';

function fakeDatabase(): Database {
  return {
    adapter: {
      removeLocal: vi.fn(async () => undefined),
    },
  } as unknown as Database;
}

function fakeStatus(): SyncStatusHooks & {
  begins: number;
  ends: Array<{ ok: boolean; errorMessage?: string } | undefined>;
  errors: string[];
} {
  const state = {
    begins: 0,
    ends: [] as Array<{ ok: boolean; errorMessage?: string } | undefined>,
    errors: [] as string[],
    beginSynchronize: () => {
      state.begins += 1;
    },
    endSynchronize: (result?: { ok: boolean; errorMessage?: string }) => {
      state.ends.push(result);
    },
    reportError: (message: string) => {
      state.errors.push(message);
    },
  };
  return state;
}

afterEach(() => {
  silenceSyncStatusHooks();
});

describe('runSynchronize', () => {
  it('pulls then pushes through WatermelonDB synchronize and reports status', async () => {
    const status = fakeStatus();
    bindSyncStatusHooks(status);

    const pull = vi.fn(async () => ({
      changes: emptySyncChanges(),
      timestamp: 5,
    }));
    const push = vi.fn(async () => ({
      applied: 0,
      timestamp: 5,
      rejected: [],
    }));

    const synchronizeImpl = vi.fn(
      async ({
        pullChanges,
        pushChanges,
      }: {
        pullChanges: (args: {
          lastPulledAt: number | null;
          schemaVersion: number;
          migration: null;
        }) => Promise<{ changes: unknown; timestamp: number }>;
        pushChanges?: (args: {
          changes: Record<
            string,
            { created: unknown[]; updated: unknown[]; deleted: string[] }
          >;
          lastPulledAt: number;
        }) => Promise<unknown>;
      }) => {
        const pulled = await pullChanges({
          lastPulledAt: null,
          schemaVersion: 1,
          migration: null,
        });
        expect(pulled.timestamp).toBe(5);
        await pushChanges?.({
          changes: {
            places: { created: [], updated: [], deleted: [] },
          },
          lastPulledAt: pulled.timestamp,
        });
      },
    );

    await runSynchronize({
      database: fakeDatabase(),
      getAccessToken: () => TOKEN,
      deviceId: DEVICE,
      client: { pull, push },
      synchronizeImpl: synchronizeImpl as never,
    });

    expect(pull).toHaveBeenCalledWith(0);
    expect(status.begins).toBe(1);
    expect(status.ends).toEqual([{ ok: true }]);
    expect(status.errors).toEqual([]);
  });

  it('retries on 409 PULL_REQUIRED then succeeds', async () => {
    const status = fakeStatus();
    let calls = 0;
    const synchronizeImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new SyncHttpError({
          status: 409,
          code: SyncErrorCodes.PULL_REQUIRED,
          message: 'Pull and rebase before pushing',
        });
      }
    });

    await runSynchronize({
      database: fakeDatabase(),
      getAccessToken: () => TOKEN,
      deviceId: DEVICE,
      client: {
        pull: async () => ({ changes: emptySyncChanges(), timestamp: 1 }),
        push: async () => ({ applied: 0, timestamp: 1, rejected: [] }),
      },
      synchronizeImpl: synchronizeImpl as never,
      status,
    });

    expect(calls).toBe(2);
    expect(status.ends).toEqual([{ ok: true }]);
  });

  it('resets cursor on CURSOR_TOO_OLD and retries', async () => {
    const resetCursor = vi.fn(async () => undefined);
    let calls = 0;
    const synchronizeImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new SyncHttpError({
          status: 409,
          code: SyncErrorCodes.CURSOR_TOO_OLD,
          message: 'Cursor too old',
        });
      }
    });

    await runSynchronize({
      database: fakeDatabase(),
      getAccessToken: () => TOKEN,
      deviceId: DEVICE,
      client: {
        pull: async () => ({ changes: emptySyncChanges(), timestamp: 1 }),
        push: async () => ({ applied: 0, timestamp: 1, rejected: [] }),
      },
      synchronizeImpl: synchronizeImpl as never,
      resetCursor,
      status: fakeStatus(),
    });

    expect(resetCursor).toHaveBeenCalledOnce();
    expect(calls).toBe(2);
  });

  it('surfaces failures via endSynchronize + reportError', async () => {
    const status = fakeStatus();
    const synchronizeImpl = vi.fn(async () => {
      throw new Error('network down');
    });

    await expect(
      runSynchronize({
        database: fakeDatabase(),
        getAccessToken: () => TOKEN,
        deviceId: DEVICE,
        client: {
          pull: async () => ({ changes: emptySyncChanges(), timestamp: 1 }),
          push: async () => ({ applied: 0, timestamp: 1, rejected: [] }),
        },
        synchronizeImpl: synchronizeImpl as never,
        status,
      }),
    ).rejects.toThrow(/network down/);

    expect(status.ends).toEqual([
      { ok: false, errorMessage: 'network down' },
    ]);
    expect(status.errors).toEqual(['network down']);
  });

  it('parks rejected push rows via experimentalRejectedIds', async () => {
    const POINT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const push = vi.fn(async () => ({
      applied: 0,
      timestamp: 9,
      rejected: [
        {
          table: 'points' as const,
          id: POINT,
          code: SyncErrorCodes.FORBIDDEN,
          message: 'Forbidden',
        },
      ],
    }));

    let pushResult: unknown;
    const synchronizeImpl = vi.fn(
      async ({
        pullChanges,
        pushChanges,
      }: {
        pullChanges: (args: {
          lastPulledAt: number | null;
          schemaVersion: number;
          migration: null;
        }) => Promise<{ changes: unknown; timestamp: number }>;
        pushChanges?: (args: {
          changes: Record<
            string,
            { created: unknown[]; updated: unknown[]; deleted: string[] }
          >;
          lastPulledAt: number;
        }) => Promise<unknown>;
      }) => {
        const pulled = await pullChanges({
          lastPulledAt: 8,
          schemaVersion: 1,
          migration: null,
        });
        pushResult = await pushChanges?.({
          changes: {
            points: {
              created: [
                {
                  id: POINT,
                  owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                  title: 'X',
                  lat: 1,
                  lon: 2,
                  visibility: 'private',
                  created_at: Date.now(),
                  updated_at: Date.now(),
                  updated_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                },
              ],
              updated: [],
              deleted: [],
            },
          },
          lastPulledAt: pulled.timestamp,
        });
      },
    );

    await runSynchronize({
      database: fakeDatabase(),
      getAccessToken: () => TOKEN,
      deviceId: DEVICE,
      client: {
        pull: async () => ({ changes: emptySyncChanges(), timestamp: 9 }),
        push,
      },
      synchronizeImpl: synchronizeImpl as never,
      status: fakeStatus(),
    });

    expect(pushResult).toEqual({
      experimentalRejectedIds: { points: [POINT] },
    });
  });
});
