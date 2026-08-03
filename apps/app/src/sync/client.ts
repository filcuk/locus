/**
 * App-side sync HTTP binding (AGENTS §4). Network I/O for sync is allowed only
 * under `src/sync/**`. Wire helpers live in `@locus/shared`; this module binds
 * them to the user-configured server URL and real Bearer tokens.
 */

import {
  createSyncClient,
  type SyncClient,
  type SyncClientOptions,
  type SyncFetch,
} from '@locus/shared';

import { getServerUrl } from '../config/server-url';
import {
  resolveAccessToken,
  type AccessTokenGetter,
} from './auth';

export {
  SYNC_SCHEMA_VERSION,
  SyncHttpError,
  createSyncClient,
  proveSyncRoundTrip,
  type SyncClient,
  type SyncClientOptions,
  type SyncFetch,
} from '@locus/shared';

export type { AccessTokenGetter } from './auth';
export { SyncAuthError } from './auth';

/**
 * Placeholder principal for `@locus/shared` createSyncClient, which still types
 * `userId` as required. The authed fetch strip removes `X-Locus-User-Id` so the
 * wire carries Bearer only (P1-D acceptance).
 */
const AUTH_HEADER_PLACEHOLDER_USER =
  '00000000-0000-4000-8000-000000000000';

export type AppSyncClientOptions = Omit<SyncClientOptions, 'baseUrl' | 'userId'> & {
  /** Override `getServerUrl()` — mainly for tests. */
  baseUrl?: string;
  /**
   * Returns a Bearer access token (P1-B session). Required for real sync I/O.
   * Sync never persists tokens itself.
   */
  getAccessToken: AccessTokenGetter;
  /**
   * Optional legacy principal for tests that still speak `X-Locus-User-Id`.
   * When set, that header is kept alongside Authorization (migration seam).
   */
  userId?: string;
};

function headerRecord(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  return { ...(headers ?? {}) };
}

function findHeaderKey(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === lower);
}

/**
 * Wrap fetch so sync requests carry `Authorization: Bearer …` and drop the
 * temporary `X-Locus-User-Id` header unless a legacy `userId` was provided.
 */
export function createAuthedSyncFetch(args: {
  getAccessToken: AccessTokenGetter;
  fetch?: SyncFetch;
  /** When true, keep `x-locus-user-id` set by createSyncClient. */
  keepLegacyUserHeader?: boolean;
}): SyncFetch {
  const base: SyncFetch =
    args.fetch ??
    ((input, init) => globalThis.fetch(input, init));

  return async (input, init) => {
    const token = await resolveAccessToken(args.getAccessToken);
    const headers = headerRecord(init?.headers);
    if (!args.keepLegacyUserHeader) {
      const userKey = findHeaderKey(headers, 'x-locus-user-id');
      if (userKey !== undefined) {
        delete headers[userKey];
      }
    }
    headers['authorization'] = `Bearer ${token}`;
    return base(input, { ...init, headers });
  };
}

export function createAppSyncClient(options: AppSyncClientOptions): SyncClient {
  const baseUrl = options.baseUrl ?? getServerUrl();
  if (baseUrl === null || baseUrl.length === 0) {
    throw new Error('Server URL is not configured');
  }

  const keepLegacyUserHeader =
    options.userId !== undefined && options.userId.length > 0;

  return createSyncClient({
    baseUrl,
    userId: keepLegacyUserHeader
      ? options.userId!
      : AUTH_HEADER_PLACEHOLDER_USER,
    deviceId: options.deviceId,
    fetch: createAuthedSyncFetch({
      getAccessToken: options.getAccessToken,
      fetch: options.fetch,
      keepLegacyUserHeader,
    }),
  });
}
