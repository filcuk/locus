/**
 * Sync HTTP transport helpers for the DESIGN §5 wire contract.
 * The Expo WatermelonDB `synchronize()` adapter lives in `apps/app/src/sync`
 * and calls this; API tests use the same helpers for the round-trip proof.
 */

import {
  SyncErrorCodes,
  SyncPullResponseSchema,
  SyncPushRequestSchema,
  SyncPushResponseSchema,
  type SyncChanges,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
} from '../schemas/sync.js';

export const SYNC_SCHEMA_VERSION = 1;

/** Minimal fetch shape so Node and browser callers share one type. */
export type SyncFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<Response>;

export type SyncClientOptions = {
  /** Origin only — no trailing slash. */
  baseUrl: string;
  userId: string;
  deviceId: string;
  /** Injected for tests (Hono `app.request` adapter). Defaults to global fetch. */
  fetch?: SyncFetch;
};

export type SyncClientError = {
  status: number;
  code?: string;
  message: string;
};

export class SyncHttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(error: SyncClientError) {
    super(error.message);
    this.name = 'SyncHttpError';
    this.status = error.status;
    this.code = error.code;
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function defaultFetch(): SyncFetch {
  const impl = globalThis.fetch.bind(globalThis);
  return (input, init) => impl(input, init);
}

async function readError(res: Response): Promise<SyncClientError> {
  const body: unknown = await res.json().catch(() => null);
  if (
    body !== null &&
    typeof body === 'object' &&
    'message' in body &&
    typeof (body as { message: unknown }).message === 'string'
  ) {
    const code =
      'code' in body && typeof (body as { code: unknown }).code === 'string'
        ? (body as { code: string }).code
        : undefined;
    return {
      status: res.status,
      code,
      message: (body as { message: string }).message,
    };
  }
  return { status: res.status, message: `sync HTTP ${res.status}` };
}

export function createSyncClient(options: SyncClientOptions) {
  const fetchImpl = options.fetch ?? defaultFetch();

  async function pull(cursor: number): Promise<SyncPullResponse> {
    const url = new URL(joinUrl(options.baseUrl, '/sync/pull'));
    url.searchParams.set('cursor', String(cursor));
    url.searchParams.set('device_id', options.deviceId);
    url.searchParams.set('schema_version', String(SYNC_SCHEMA_VERSION));

    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        'x-locus-user-id': options.userId,
        'x-locus-device-id': options.deviceId,
      },
    });

    if (!res.ok) {
      throw new SyncHttpError(await readError(res));
    }

    const json: unknown = await res.json();
    return SyncPullResponseSchema.parse(json);
  }

  async function push(
    body: Omit<SyncPushRequest, 'device_id'> & { device_id?: string },
  ): Promise<SyncPushResponse> {
    const request = SyncPushRequestSchema.parse({
      ...body,
      device_id: body.device_id ?? options.deviceId,
    });

    const res = await fetchImpl(joinUrl(options.baseUrl, '/sync/push'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-locus-user-id': options.userId,
        'x-locus-device-id': options.deviceId,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new SyncHttpError(await readError(res));
    }

    const json: unknown = await res.json();
    return SyncPushResponseSchema.parse(json);
  }

  return { pull, push };
}

export type SyncClient = ReturnType<typeof createSyncClient>;

/**
 * Push local changes, then pull as another device — proves the wire round-trip
 * and that `timestamp` is a usable `server_seq` cursor (DESIGN §5 / §11 spike).
 */
export async function proveSyncRoundTrip(args: {
  writer: SyncClient;
  reader: SyncClient;
  pushId: string;
  changes: Partial<SyncChanges>;
}): Promise<{
  push: SyncPushResponse;
  pull: SyncPullResponse;
  /** WatermelonDB's `lastPulledAt` field — we store server_seq here. */
  lastPulledAt: number;
}> {
  const initial = await args.writer.pull(0);
  const push = await args.writer.push({
    push_id: args.pushId,
    cursor: initial.timestamp,
    changes: args.changes,
  });

  if (push.rejected.length > 0) {
    throw new SyncHttpError({
      status: 422,
      code: SyncErrorCodes.VALIDATION_FAILED,
      message: `push rejected ${push.rejected.length} row(s)`,
    });
  }

  const lastPulledAt = push.timestamp;
  const pull = await args.reader.pull(0);

  return { push, pull, lastPulledAt };
}
