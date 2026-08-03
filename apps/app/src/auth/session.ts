/**
 * Access / refresh token persistence.
 * Clearing a session never touches WatermelonDB (DESIGN §8 / AGENTS §4).
 */

import { AuthUserSchema, type AuthTokens, type AuthUser } from '@locus/shared';

import { getSecureStorage } from './secureStorage';

const ACCESS_TOKEN_KEY = 'locus.accessToken';
const REFRESH_TOKEN_KEY = 'locus.refreshToken';
const ACCESS_EXPIRES_AT_KEY = 'locus.accessExpiresAt';
const USER_KEY = 'locus.authUser';

/** Skew so we refresh slightly before the JWT actually expires. */
const EXPIRY_SKEW_MS = 30_000;

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  user: AuthUser;
};

export async function persistSession(tokens: AuthTokens, now = Date.now()): Promise<void> {
  const storage = getSecureStorage();
  const accessExpiresAt = now + tokens.expires_in * 1000;
  await storage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  await storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  await storage.setItem(ACCESS_EXPIRES_AT_KEY, String(accessExpiresAt));
  await storage.setItem(USER_KEY, JSON.stringify(tokens.user));
}

export async function readSession(): Promise<StoredSession | null> {
  const storage = getSecureStorage();
  const accessToken = await storage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
  const expiresRaw = await storage.getItem(ACCESS_EXPIRES_AT_KEY);
  const userRaw = await storage.getItem(USER_KEY);
  if (
    accessToken === null ||
    accessToken.length === 0 ||
    refreshToken === null ||
    refreshToken.length === 0 ||
    expiresRaw === null ||
    userRaw === null
  ) {
    return null;
  }
  let userJson: unknown;
  try {
    userJson = JSON.parse(userRaw) as unknown;
  } catch {
    return null;
  }
  const user = AuthUserSchema.safeParse(userJson);
  if (!user.success) return null;
  const accessExpiresAt = Number(expiresRaw);
  if (!Number.isFinite(accessExpiresAt)) return null;
  return { accessToken, refreshToken, accessExpiresAt, user: user.data };
}

export async function hasSession(): Promise<boolean> {
  return (await readSession()) !== null;
}

/**
 * Drop tokens only. Never opens or resets WatermelonDB — a 401 / failed
 * refresh must not wipe offline data (DESIGN §8).
 */
export async function clearSession(): Promise<void> {
  const storage = getSecureStorage();
  await storage.deleteItem(ACCESS_TOKEN_KEY);
  await storage.deleteItem(REFRESH_TOKEN_KEY);
  await storage.deleteItem(ACCESS_EXPIRES_AT_KEY);
  await storage.deleteItem(USER_KEY);
}

export function isAccessTokenFresh(
  session: StoredSession,
  now = Date.now(),
): boolean {
  return session.accessExpiresAt - EXPIRY_SKEW_MS > now;
}

/** Stored access token as-is (may be expired). For sync / Authorization headers. */
export async function getAccessToken(): Promise<string | null> {
  const session = await readSession();
  return session?.accessToken ?? null;
}
