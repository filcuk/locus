import type { Database } from '@nozbe/watermelondb';
import { describe, expect, it, vi } from 'vitest';

import { createPowerSavingDriver } from './powerSaving';

function fakeDatabase(): Database {
  return {} as Database;
}

describe('createPowerSavingDriver', () => {
  it('debounces requestPush into a single synchronize', async () => {
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const synchronize = vi.fn(async () => undefined);

    const driver = createPowerSavingDriver({
      database: fakeDatabase(),
      getAccessToken: () => 'token',
      synchronize,
      pushDebounceMs: 100,
      schedule: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearSchedule: () => undefined,
    });

    driver.requestPush();
    driver.requestPush();
    expect(synchronize).not.toHaveBeenCalled();
    expect(timers).toHaveLength(2);

    // Only the latest debounce timer should matter — fire the last one.
    timers.at(-1)?.fn();
    await Promise.resolve();
    await Promise.resolve();
    expect(synchronize).toHaveBeenCalledOnce();
  });

  it('refresh runs synchronize immediately', async () => {
    const synchronize = vi.fn(async () => undefined);
    const driver = createPowerSavingDriver({
      database: fakeDatabase(),
      getAccessToken: () => 'token',
      synchronize,
      schedule: (fn) => {
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearSchedule: () => undefined,
    });

    await driver.refresh();
    expect(synchronize).toHaveBeenCalledOnce();
  });

  it('start arms interval pull and resume triggers synchronize', async () => {
    const synchronize = vi.fn(async () => undefined);
    let onResume: (() => void) | null = null;
    const intervalFns: Array<() => void> = [];

    const driver = createPowerSavingDriver({
      database: fakeDatabase(),
      getAccessToken: () => 'token',
      synchronize,
      pullIntervalMs: 1000,
      schedule: (fn, ms) => {
        if (ms === 1000) intervalFns.push(fn);
        return intervalFns.length as unknown as ReturnType<typeof setTimeout>;
      },
      clearSchedule: () => undefined,
      subscribeResume: (cb) => {
        onResume = cb;
        return () => {
          onResume = null;
        };
      },
    });

    driver.start();
    expect(intervalFns).toHaveLength(1);
    intervalFns[0]?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(synchronize).toHaveBeenCalledTimes(1);

    onResume?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(synchronize).toHaveBeenCalledTimes(2);

    driver.stop();
    expect(onResume).toBeNull();
  });

  it('cancels an in-flight pass without clearing local changes', async () => {
    let cancelled = false;
    const synchronize = vi.fn(
      async (options: { signal?: AbortSignal }): Promise<void> =>
        new Promise((resolve) => {
          options.signal?.addEventListener('abort', () => {
            cancelled = true;
            resolve();
          });
        }),
    );
    const driver = createPowerSavingDriver({
      database: fakeDatabase(),
      getAccessToken: () => 'token',
      synchronize,
    });

    const refresh = driver.refresh();
    await Promise.resolve();
    driver.cancel();
    await refresh;

    expect(cancelled).toBe(true);
    expect(synchronize).toHaveBeenCalledOnce();
  });
});
