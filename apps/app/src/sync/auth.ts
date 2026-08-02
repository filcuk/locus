/**
 * Access-token seam for the sync driver (P1-D).
 * P1-B owns session storage and single-flight refresh; until that lands,
 * callers inject a getter. Never wipe local data on 401 (DESIGN §8 / AGENTS §4).
 */

export type AccessTokenGetter = () => Promise<string | null> | string | null;

export class SyncAuthError extends Error {
  constructor(message = 'Sync requires an access token') {
    super(message);
    this.name = 'SyncAuthError';
  }
}

export async function resolveAccessToken(
  getAccessToken: AccessTokenGetter,
): Promise<string> {
  const token = await getAccessToken();
  if (token === null || token.length === 0) {
    throw new SyncAuthError();
  }
  return token;
}
