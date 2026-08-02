/**
 * App-side sync entry (AGENTS §4). Network I/O for sync is allowed only under
 * `src/sync/**`. Wire helpers live in `@locus/shared`; this module binds them
 * to the user-configured server URL.
 *
 * Gap: WatermelonDB `synchronize()` local apply/merge is not wired yet.
 */

import {
  createSyncClient,
  type SyncClient,
  type SyncClientOptions,
} from '@locus/shared';

import { getServerUrl } from '../config/server-url.js';

export {
  SYNC_SCHEMA_VERSION,
  SyncHttpError,
  createSyncClient,
  proveSyncRoundTrip,
  type SyncClient,
  type SyncClientOptions,
  type SyncFetch,
} from '@locus/shared';

export type AppSyncClientOptions = Omit<SyncClientOptions, 'baseUrl'> & {
  /** Override `getServerUrl()` — mainly for tests. */
  baseUrl?: string;
};

export function createAppSyncClient(options: AppSyncClientOptions): SyncClient {
  const baseUrl = options.baseUrl ?? getServerUrl();
  if (baseUrl === null || baseUrl.length === 0) {
    throw new Error('Server URL is not configured');
  }
  return createSyncClient({
    baseUrl,
    userId: options.userId,
    deviceId: options.deviceId,
    fetch: options.fetch,
  });
}
