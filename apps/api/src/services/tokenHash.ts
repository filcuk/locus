import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** High-entropy opaque token for refresh / password-reset (raw form only ever leaves once). */
export function newOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex digest — appropriate for high-entropy tokens (DESIGN §10). */
export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function opaqueTokensEqual(aHash: string, bHash: string): boolean {
  const a = Buffer.from(aHash, 'utf8');
  const b = Buffer.from(bHash, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
