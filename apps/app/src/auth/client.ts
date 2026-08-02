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

import { getServerUrl } from '../config/server-url.js';
import { getOrCreateDeviceId } from './deviceId.js';
import {
  clearSession,
  getAccessToken,
  hasSession,
  isAccessTokenFresh,
  persistSession,
  readSession,
} from './session.js';

export type AuthFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

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

type ClientOptions = {
  baseUrl?: string;
  fetch?: AuthFetch;
  now?: () => number;
};

let fetchOverride: AuthFetch | null = null;
let refreshInFlight: Promise<string | null> | null = null;

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

async function postJson<T>(
  path: string,
  body: unknown,
  parse: (data: unknown) => T,
  options?: ClientOptions,
): Promise<T> {
  const fetchImpl = resolveFetch(options);
  const res = await fetchImpl(joinUrl(resolveBaseUrl(options), path), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await parseError(res);
  }
  const json: unknown = await res.json();
  return parse(json);
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
