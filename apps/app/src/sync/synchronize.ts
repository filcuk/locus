/**
 * WatermelonDB `synchronize()` adapter over DESIGN §5 pull/push.
 *
 * - Cursor = server_seq stored in `lastPulledAt` (no wall-clock conversion)
 * - `409 PULL_REQUIRED` → pull/rebase/retry
 * - `409 CURSOR_TOO_OLD` → reset cursor to 0 and retry
 * - Rejected push rows park via `experimentalRejectedIds` (hard part 5)
 * - Status hooks call P1-F begin/end/error
 */

import {
  newEntityId,
  SyncCancelledError,
  SyncErrorCodes,
  SyncHttpError,
  type SyncProgress,
} from '@locus/shared';
import type { Database } from '@nozbe/watermelondb';
import {
  synchronize as watermelonSynchronize,
  type SyncPullArgs,
  type SyncPushArgs,
  type SyncPushResult,
} from '@nozbe/watermelondb/sync';

import type { AccessTokenGetter } from './auth';
import { createAppSyncClient, type SyncClient } from './client';
import { toServerCursor, toWatermelonTimestamp } from './cursor';
import { getDeviceId } from './deviceId';
import {
  pullChangesToWatermelon,
  rejectedIdsFromPush,
  watermelonChangesToPush,
} from './encode';
import {
  getSyncStatusHooks,
  type SyncStatusHooks,
} from './status';

const DEFAULT_MAX_PULL_REQUIRED_RETRIES = 3;

export type SynchronizeOptions = {
  database: Database;
  getAccessToken: AccessTokenGetter;
  /** Defaults to `getDeviceId()`. */
  deviceId?: string;
  baseUrl?: string;
  /** Override HTTP client (tests). */
  client?: SyncClient;
  /** Override WatermelonDB synchronize (tests). */
  synchronizeImpl?: typeof watermelonSynchronize;
  /** Defaults to bound P1-F hooks. */
  status?: SyncStatusHooks;
  /** Max full synchronize() attempts after PULL_REQUIRED / CURSOR_TOO_OLD. */
  maxRetries?: number;
  /** Cancels the current pass without touching local data. */
  signal?: AbortSignal;
  /** Reports transport attempts to the status owner. */
  onProgress?: (progress: SyncProgress) => void;
  /** Clear lastPulledAt — injected for CURSOR_TOO_OLD tests. */
  resetCursor?: (database: Database) => Promise<void>;
};

async function defaultResetCursor(database: Database): Promise<void> {
  await database.adapter.removeLocal('__watermelon_last_pulled_at');
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function isSyncHttpError(err: unknown): err is SyncHttpError {
  return err instanceof SyncHttpError;
}

export async function runSynchronize(
  options: SynchronizeOptions,
): Promise<void> {
  const status = options.status ?? getSyncStatusHooks();
  const synchronizeImpl = options.synchronizeImpl ?? watermelonSynchronize;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_PULL_REQUIRED_RETRIES;
  const resetCursor = options.resetCursor ?? defaultResetCursor;
  const deviceId = options.deviceId ?? (await getDeviceId());

  const client =
    options.client ??
    createAppSyncClient({
      getAccessToken: options.getAccessToken,
      deviceId,
      baseUrl: options.baseUrl,
      signal: options.signal,
      onProgress: options.onProgress,
    });

  status.beginSynchronize();

  let attempt = 0;
  try {
    while (true) {
      if (options.signal?.aborted) {
        throw new SyncCancelledError();
      }
      attempt += 1;
      try {
        await synchronizeImpl({
          database: options.database,
          pullChanges: async ({ lastPulledAt }: SyncPullArgs) => {
            const cursor = toServerCursor(lastPulledAt);
            const pulled = await client.pull(cursor);
            return {
              changes: pullChangesToWatermelon(pulled.changes),
              timestamp: toWatermelonTimestamp(pulled.timestamp),
            };
          },
          pushChanges: async ({
            changes,
            lastPulledAt,
          }: SyncPushArgs): Promise<SyncPushResult | undefined> => {
            const pushChanges = watermelonChangesToPush(changes);
            const hasRows = Object.values(pushChanges).some(
              (bag) =>
                bag !== undefined &&
                (bag.created.length > 0 ||
                  bag.updated.length > 0 ||
                  bag.deleted.length > 0),
            );
            if (!hasRows) return undefined;

            const pushed = await client.push({
              push_id: newEntityId(),
              cursor: toServerCursor(lastPulledAt),
              changes: pushChanges,
            });

            if (pushed.rejected.length === 0) return undefined;
            return {
              experimentalRejectedIds: rejectedIdsFromPush(pushed.rejected),
            };
          },
        });
        status.endSynchronize({ ok: true });
        return;
      } catch (err) {
        if (
          isSyncHttpError(err) &&
          err.code === SyncErrorCodes.PULL_REQUIRED &&
          attempt <= maxRetries
        ) {
          continue;
        }
        if (
          isSyncHttpError(err) &&
          err.code === SyncErrorCodes.CURSOR_TOO_OLD &&
          attempt <= maxRetries
        ) {
          await resetCursor(options.database);
          continue;
        }
        throw err;
      }
    }
  } catch (err) {
    if (options.signal?.aborted || err instanceof SyncCancelledError) {
      status.endSynchronize({ ok: true });
      return;
    }
    const message = errorMessage(err);
    status.endSynchronize({ ok: false, errorMessage: message });
    status.reportError(message);
    throw err;
  }
}
