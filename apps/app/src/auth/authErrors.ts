/**
 * Map auth failures to user-facing strings.
 * Callers pass already-translated catalogue strings for known codes.
 * Never surface tokens, stack traces, or Zod dumps.
 */

import {
  AuthCancelledError,
  AuthHttpError,
  AuthTimeoutError,
} from './client';

const SECRETISH = /token|password|secret|authorization|bearer|refresh/i;

/** Short, non-sensitive server `message` suitable for display. */
export function safeServerMessage(message: string | undefined): string | null {
  if (message === undefined) return null;
  const trimmed = message.trim();
  if (trimmed.length === 0 || trimmed.length > 180) return null;
  if (SECRETISH.test(trimmed)) return null;
  // Zod / structured dumps look like JSON arrays or objects.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) return null;
  if (trimmed.includes('\n')) return null;
  return trimmed;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof AuthTimeoutError) return true;
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

export function isAuthCancelled(err: unknown): boolean {
  return err instanceof AuthCancelledError;
}

export type AuthErrorCopy = {
  /** Translated strings keyed by API `error` code. */
  known: Partial<Record<string, string>>;
  network: string;
  generic: string;
};

/**
 * Resolve a register/login/forgot error to display text.
 * Known codes take precedence; otherwise a safe server message; else generic.
 */
export function messageForAuthError(
  err: unknown,
  copy: AuthErrorCopy,
): string {
  if (err instanceof AuthHttpError) {
    const mapped = copy.known[err.code];
    if (mapped !== undefined) return mapped;
    const safe = safeServerMessage(err.message);
    if (safe !== null && safe !== err.code) return safe;
    return copy.generic;
  }
  if (isNetworkFailure(err)) {
    return copy.network;
  }
  return copy.generic;
}
