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
export const DEFAULT_SYNC_REQUEST_TIMEOUT_MS = 5_000;
export const DEFAULT_SYNC_TRANSPORT_RETRIES = 2;
export const SYNC_RETRY_BACKOFF_MS = [500, 1_000] as const;

/** Minimal fetch shape so Node and browser callers share one type. */
export type SyncFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<Response>;

export type SyncProgress = {
  attempt: number;
  maxAttempts: number;
};

export type SyncClientOptions = {
  /** Origin only — no trailing slash. */
  baseUrl: string;
  userId: string;
  deviceId: string;
  /** Injected for tests (Hono `app.request` adapter). Defaults to global fetch. */
  fetch?: SyncFetch;
  /** Cancels the current sync pass without touching local data. */
  signal?: AbortSignal;
  /** Per-request transport deadline. */
  timeoutMs?: number;
  /** Retries for network failures and HTTP 5xx responses. */
  maxTransportRetries?: number;
  /** Injected delay for retry tests. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  /** Reports transport attempts to the connection-status owner. */
  onProgress?: (progress: SyncProgress) => void;
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

export class SyncCancelledError extends Error {
  constructor() {
    super('Sync cancelled');
    this.name = 'SyncCancelledError';
  }
}

export class SyncTimeoutError extends Error {
  constructor() {
    super('Sync request timed out');
    this.name = 'SyncTimeoutError';
  }
}

function retryDelay(attempt: number): number {
  return (
    SYNC_RETRY_BACKOFF_MS[attempt - 1] ??
    SYNC_RETRY_BACKOFF_MS[SYNC_RETRY_BACKOFF_MS.length - 1] ??
    0
  );
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

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new SyncCancelledError());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new SyncCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

async function request(
  fetchImpl: SyncFetch,
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  },
  options: SyncClientOptions,
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_SYNC_REQUEST_TIMEOUT_MS;
  const maxRetries =
    options.maxTransportRetries ?? DEFAULT_SYNC_TRANSPORT_RETRIES;
  const maxAttempts = maxRetries + 1;
  const sleep = options.sleep ?? wait;
  let lastError: unknown = new Error('Sync request failed');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new SyncCancelledError();
    }
    options.onProgress?.({ attempt, maxAttempts });

    const controller = new AbortController();
    let timedOut = false;
    const onParentAbort = (): void => {
      controller.abort();
    };
    options.signal?.addEventListener('abort', onParentAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: controller.signal,
      });
      if (isRetryableStatus(response.status) && attempt < maxAttempts) {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', onParentAbort);
        await sleep(retryDelay(attempt), options.signal);
        continue;
      }
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onParentAbort);
      return response;
    } catch (error) {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onParentAbort);
      if (options.signal?.aborted) {
        throw new SyncCancelledError();
      }
      lastError = timedOut ? new SyncTimeoutError() : error;
      if (attempt >= maxAttempts) {
        throw lastError;
      }
      await sleep(retryDelay(attempt), options.signal);
    }
  }

  throw lastError;
}

export function createSyncClient(options: SyncClientOptions) {
  const fetchImpl = options.fetch ?? defaultFetch();

  async function pull(cursor: number): Promise<SyncPullResponse> {
    const url = new URL(joinUrl(options.baseUrl, '/sync/pull'));
    url.searchParams.set('cursor', String(cursor));
    url.searchParams.set('device_id', options.deviceId);
    url.searchParams.set('schema_version', String(SYNC_SCHEMA_VERSION));

    const res = await request(fetchImpl, url.toString(), {
      method: 'GET',
      headers: {
        'x-locus-user-id': options.userId,
        'x-locus-device-id': options.deviceId,
      },
    }, options);

    if (!res.ok) {
      throw new SyncHttpError(await readError(res));
    }

    const json: unknown = await res.json();
    return SyncPullResponseSchema.parse(json);
  }

  async function push(
    body: Omit<SyncPushRequest, 'device_id'> & { device_id?: string },
  ): Promise<SyncPushResponse> {
    const requestBody = SyncPushRequestSchema.parse({
      ...body,
      device_id: body.device_id ?? options.deviceId,
    });

    const res = await request(fetchImpl, joinUrl(options.baseUrl, '/sync/push'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-locus-user-id': options.userId,
        'x-locus-device-id': options.deviceId,
      },
      body: JSON.stringify(requestBody),
    }, options);

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
