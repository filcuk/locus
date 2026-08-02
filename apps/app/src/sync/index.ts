export {
  SYNC_SCHEMA_VERSION,
  SyncAuthError,
  SyncHttpError,
  createAppSyncClient,
  createAuthedSyncFetch,
  createSyncClient,
  proveSyncRoundTrip,
  type AccessTokenGetter,
  type AppSyncClientOptions,
  type SyncClient,
  type SyncClientOptions,
  type SyncFetch,
} from './client.js';

export {
  EMPTY_WATERMARK_SENTINEL,
  toServerCursor,
  toWatermelonTimestamp,
} from './cursor.js';

export {
  clearDeviceId,
  getDeviceId,
  setDeviceId,
} from './deviceId.js';

export {
  emptyWatermelonChanges,
  pullChangesToWatermelon,
  rawRowToWire,
  rejectedIdsFromPush,
  watermelonChangesToPush,
  wireRowToRaw,
} from './encode.js';

export {
  DEFAULT_PULL_INTERVAL_MS,
  DEFAULT_PUSH_DEBOUNCE_MS,
  createPowerSavingDriver,
  type PowerSavingDriver,
  type PowerSavingDriverOptions,
} from './powerSaving.js';

export {
  bindSyncStatusHooks,
  getSyncStatusHooks,
  unbindSyncStatusHooks,
  type SyncStatusHooks,
} from './status.js';

export { runSynchronize, type SynchronizeOptions } from './synchronize.js';
