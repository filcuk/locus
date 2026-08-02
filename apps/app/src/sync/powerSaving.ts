/**
 * Power-saving sync mode (DESIGN §5 default online path):
 * debounced push after change; pull on interval / resume / explicit refresh.
 * No persistent socket (Live = P5).
 *
 * UI must not block — callers fire-and-forget `requestPush` / `refresh`.
 */

import type { Database } from '@nozbe/watermelondb';

import type { AccessTokenGetter } from './auth.js';
import { runSynchronize, type SynchronizeOptions } from './synchronize.js';

export const DEFAULT_PUSH_DEBOUNCE_MS = 750;
export const DEFAULT_PULL_INTERVAL_MS = 60_000;

export type PowerSavingDriverOptions = {
  database: Database;
  getAccessToken: AccessTokenGetter;
  deviceId?: string;
  baseUrl?: string;
  pushDebounceMs?: number;
  pullIntervalMs?: number;
  /** Injected synchronize (tests). */
  synchronize?: (options: SynchronizeOptions) => Promise<void>;
  /** Clock for tests. */
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearSchedule?: (id: ReturnType<typeof setTimeout>) => void;
  /** App foreground / resume notifier. Returns unsubscribe. */
  subscribeResume?: (onResume: () => void) => () => void;
};

export type PowerSavingDriver = {
  /** Start interval pull + resume listener. */
  start: () => void;
  /** Stop timers and listeners; in-flight sync is left to finish. */
  stop: () => void;
  /** Debounced synchronize after a local write. */
  requestPush: () => void;
  /** Immediate synchronize (pull-to-refresh / explicit). */
  refresh: () => Promise<void>;
  /** Whether a synchronize() is currently running. */
  isSyncing: () => boolean;
};

export function createPowerSavingDriver(
  options: PowerSavingDriverOptions,
): PowerSavingDriver {
  const pushDebounceMs = options.pushDebounceMs ?? DEFAULT_PUSH_DEBOUNCE_MS;
  const pullIntervalMs = options.pullIntervalMs ?? DEFAULT_PULL_INTERVAL_MS;
  const schedule = options.schedule ?? setTimeout;
  const clearSchedule = options.clearSchedule ?? clearTimeout;
  const synchronize = options.synchronize ?? runSynchronize;

  let started = false;
  let syncing = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribeResume: (() => void) | null = null;
  /** Serialize synchronize() — WatermelonDB forbids concurrent runs. */
  let chain: Promise<void> = Promise.resolve();

  const run = (): Promise<void> => {
    chain = chain.then(async () => {
      if (syncing) return;
      syncing = true;
      try {
        await synchronize({
          database: options.database,
          getAccessToken: options.getAccessToken,
          deviceId: options.deviceId,
          baseUrl: options.baseUrl,
        });
      } catch {
        // Status hooks already recorded the error; swallow so the queue continues.
      } finally {
        syncing = false;
      }
    });
    return chain;
  };

  const clearDebounce = (): void => {
    if (debounceTimer !== null) {
      clearSchedule(debounceTimer);
      debounceTimer = null;
    }
  };

  const clearIntervalTimer = (): void => {
    if (intervalTimer !== null) {
      clearSchedule(intervalTimer);
      intervalTimer = null;
    }
  };

  const armInterval = (): void => {
    clearIntervalTimer();
    if (!started) return;
    intervalTimer = schedule(() => {
      void run().finally(() => {
        armInterval();
      });
    }, pullIntervalMs);
  };

  return {
    start: () => {
      if (started) return;
      started = true;
      armInterval();
      if (options.subscribeResume) {
        unsubscribeResume = options.subscribeResume(() => {
          void run();
        });
      }
    },
    stop: () => {
      started = false;
      clearDebounce();
      clearIntervalTimer();
      if (unsubscribeResume) {
        unsubscribeResume();
        unsubscribeResume = null;
      }
    },
    requestPush: () => {
      clearDebounce();
      debounceTimer = schedule(() => {
        debounceTimer = null;
        void run();
      }, pushDebounceMs);
    },
    refresh: () => {
      clearDebounce();
      return run();
    },
    isSyncing: () => syncing,
  };
}
