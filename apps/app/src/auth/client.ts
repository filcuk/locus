/**
 * Auth API client — the only network owner for login / register / refresh /
 * password-reset (with `src/sync` for sync and the future photo upload queue).
 * Refresh is single-flight so concurrent 401s cannot loop-logout (DESIGN §8).
 */

import {
  AuthTokensSchema,
  OkResponseSchema,
  type AuthTokens,
  type AuthUser,
  type LoginRequest,
  type PasswordResetRequest,
  type RegisterRequest,
} from '@locus/shared';

import { getServerUrl } from '../config/server-url';
import { getOrCreateDeviceId } from './deviceId';
import {
  clearSession,
  getAccessToken,
  hasSession,
  isAccessTokenFresh,
  persistSession,
  readSession,
} from './session';

export type AuthFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export const AUTH_REQUEST_TIMEOUT_MS = 5_000;
export const AUTH_TRANSPORT_RETRIES = 2;
export const AUTH_RETRY_BACKOFF_MS = [500, 1_000] as const;

export type AuthProgress = {
  attempt: number;
  maxAttempts: number;
};

export class AuthHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'AuthHttpError';
    this.status = status;
    this.code = code;
  }
}

export class AuthCancelledError extends Error {
  constructor() {
    super('Connection attempt cancelled');
    this.name = 'AuthCancelledError';
  }
}

export class AuthTimeoutError extends Error {
  constructor() {
    super('Connection request timed out');
    this.name = 'AuthTimeoutError';
  }
}

export type ClientOptions = {
  baseUrl?: string;
  fetch?: AuthFetch;
  now?: () => number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (progress: AuthProgress) => void;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

let fetchOverride: AuthFetch | null = null;
let refreshInFlight: Promise<string | null> | null = null;

function retryDelay(attempt: number): number {
  return (
    AUTH_RETRY_BACKOFF_MS[attempt - 1] ??
    AUTH_RETRY_BACKOFF_MS[AUTH_RETRY_BACKOFF_MS.length - 1] ??
    0
  );
}

export function setAuthFetchForTests(fetchImpl: AuthFetch | null): void {
  fetchOverride = fetchImpl;
}

function resolveFetch(options?: ClientOptions): AuthFetch {
  if (options?.fetch) return options.fetch;
  if (fetchOverride) return fetchOverride;
  return globalThis.fetch.bind(globalThis);
}

function resolveBaseUrl(options?: ClientOptions): string {
  const baseUrl = options?.baseUrl ?? getServerUrl();
  if (baseUrl === null || baseUrl.length === 0) {
    throw new Error('Server URL is not configured');
  }
  return baseUrl.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseError(res: Response): Promise<AuthHttpError> {
  let code = 'request_failed';
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    if (typeof body.error === 'string' && body.error.length > 0) {
      code = body.error;
    }
    return new AuthHttpError(res.status, code, body.message);
  } catch {
    return new AuthHttpError(res.status, code);
  }
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new AuthCancelledError());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new AuthCancelledError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchWithDeadline(
  fetchImpl: AuthFetch,
  input: string,
  init: RequestInit,
  options?: ClientOptions,
): Promise<Response> {
  if (options?.signal?.aborted) {
    throw new AuthCancelledError();
  }
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = (): void => {
    controller.abort();
  };
  options?.signal?.addEventListener('abort', onParentAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options?.timeoutMs ?? AUTH_REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (options?.signal?.aborted) {
      throw new AuthCancelledError();
    }
    if (timedOut) {
      throw new AuthTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener('abort', onParentAbort);
  }
}

async function postJson<T>(
  path: string,
  body: unknown,
  parse: (data: unknown) => T,
  options?: ClientOptions,
): Promise<T> {
  const fetchImpl = resolveFetch(options);
  options?.onProgress?.({ attempt: 1, maxAttempts: 1 });
  const res = await fetchWithDeadline(
    fetchImpl,
    joinUrl(resolveBaseUrl(options), path),
    {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    },
    options,
  );
  if (!res.ok) {
    throw await parseError(res);
  }
  const json: unknown = await res.json();
  return parse(json);
}

/**
 * Probe an instance before changing the active server. GET /health is safe to
 * retry; auth mutations intentionally use postJson's single attempt.
 */
export async function probeServer(options: ClientOptions = {}): Promise<void> {
  const fetchImpl = resolveFetch(options);
  const baseUrl = resolveBaseUrl(options);
  const maxAttempts = AUTH_TRANSPORT_RETRIES + 1;
  const sleep = options.sleep ?? wait;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new AuthCancelledError();
    }
    options.onProgress?.({ attempt, maxAttempts });
    try {
      const response = await fetchWithDeadline(
        fetchImpl,
        joinUrl(baseUrl, '/health'),
        { method: 'GET', headers: { accept: 'application/json' } },
        options,
      );
      if (response.ok) return;
      const error = await parseError(response);
      if (response.status < 500 || attempt >= maxAttempts) {
        throw error;
      }
    } catch (error) {
      if (error instanceof AuthCancelledError) {
        throw error;
      }
      if (
        error instanceof AuthHttpError &&
        (error.status < 500 || attempt >= maxAttempts)
      ) {
        throw error;
      }
      if (attempt >= maxAttempts) {
        throw error;
      }
    }
    await sleep(
      retryDelay(attempt),
      options.signal,
    );
  }
}

async function storeTokens(tokens: AuthTokens, options?: ClientOptions): Promise<AuthTokens> {
  const now = options?.now?.() ?? Date.now();
  await persistSession(tokens, now);
  return tokens;
}

export async function register(
  input: Omit<RegisterRequest, 'device_id'>,
  options?: ClientOptions,
): Promise<AuthTokens> {
  const device_id = await getOrCreateDeviceId();
  const tokens = await postJson(
    '/auth/register',
    { ...input, device_id },
    (data) => AuthTokensSchema.parse(data),
    options,
  );
  return storeTokens(tokens, options);
}

export async function login(
  input: Omit<LoginRequest, 'device_id'>,
  options?: ClientOptions,
): Promise<AuthTokens> {
  const device_id = await getOrCreateDeviceId();
  const tokens = await postJson(
    '/auth/login',
    { ...input, device_id },
    (data) => AuthTokensSchema.parse(data),
    options,
  );
  return storeTokens(tokens, options);
}

export async function requestPasswordReset(
  input: PasswordResetRequest,
  options?: ClientOptions,
): Promise<void> {
  await postJson(
    '/auth/password-reset/request',
    input,
    (data) => OkResponseSchema.parse(data),
    options,
  );
}

export async function logout(options?: ClientOptions): Promise<void> {
  const session = await readSession();
  if (session !== null) {
    try {
      await postJson(
        '/auth/logout',
        { refresh_token: session.refreshToken },
        (data) => OkResponseSchema.parse(data),
        options,
      );
    } catch {
      // Still clear local tokens — server revoke is best-effort.
    }
  }
  await clearSession();
}

async function refreshOnce(options?: ClientOptions): Promise<string | null> {
  const session = await readSession();
  if (session === null) return null;

  const device_id = await getOrCreateDeviceId();
  try {
    const tokens = await postJson(
      '/auth/refresh',
      { refresh_token: session.refreshToken, device_id },
      (data) => AuthTokensSchema.parse(data),
      options,
    );
    await storeTokens(tokens, options);
    return tokens.access_token;
  } catch (err) {
    if (err instanceof AuthHttpError && err.status === 401) {
      // Tokens only — never wipe local DB.
      await clearSession();
      return null;
    }
    throw err;
  }
}

/**
 * Single-flight refresh. Concurrent callers share one in-flight request so a
 * burst of 401s cannot rotate the refresh token multiple times and log out.
 */
export async function refreshAccessToken(
  options?: ClientOptions,
): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = refreshOnce(options).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * Access token for the sync driver (P1-D). Refreshes when missing/stale;
 * returns null if the session cannot be renewed (caller must not wipe DB).
 */
export async function getValidAccessToken(
  options?: ClientOptions,
): Promise<string | null> {
  const now = options?.now?.() ?? Date.now();
  const session = await readSession();
  if (session !== null && isAccessTokenFresh(session, now)) {
    return session.accessToken;
  }
  if (session !== null) {
    return refreshAccessToken(options);
  }
  return getAccessToken();
}

export async function getSessionUser(): Promise<AuthUser | null> {
  return (await readSession())?.user ?? null;
}

/**
 * Bearer header for P1-D sync / other authenticated callers.
 * Returns null when signed out or refresh failed — never wipe local data.
 */
export async function getAuthorizationHeader(
  options?: ClientOptions,
): Promise<string | null> {
  const token = await getValidAccessToken(options);
  if (token === null) return null;
  return `Bearer ${token}`;
}

export { getAccessToken, clearSession, hasSession, readSession };
