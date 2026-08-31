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
} from './client';

export {
  EMPTY_WATERMARK_SENTINEL,
  toServerCursor,
  toWatermelonTimestamp,
} from './cursor';

export {
  clearDeviceId,
  getDeviceId,
  setDeviceId,
} from './deviceId';

export {
  emptyWatermelonChanges,
  pullChangesToWatermelon,
  rawRowToWire,
  rejectedIdsFromPush,
  watermelonChangesToPush,
  wireRowToRaw,
} from './encode';

export {
  DEFAULT_PULL_INTERVAL_MS,
  DEFAULT_PUSH_DEBOUNCE_MS,
  createPowerSavingDriver,
  type PowerSavingDriver,
  type PowerSavingDriverOptions,
} from './powerSaving';

export {
  bindActiveSyncDriver,
  cancelSync,
  refreshSync,
  requestSyncPush,
  unbindActiveSyncDriver,
} from './activeDriver';

export { SyncDriverProvider } from './SyncDriverProvider';

export {
  bindSyncStatusHooks,
  getSyncStatusHooks,
  silenceSyncStatusHooks,
  unbindSyncStatusHooks,
  type SyncStatusHooks,
} from './status';

export { runSynchronize, type SynchronizeOptions } from './synchronize';
