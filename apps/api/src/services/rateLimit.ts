/**
 * In-memory sliding window — acceptable for one container (DESIGN §10).
 * Resets on process restart.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
}): { allow: (key: string) => boolean } {
  const hits = new Map<string, number[]>();

  return {
    allow(key: string): boolean {
      const now = Date.now();
      const windowStart = now - opts.windowMs;
      const prior = hits.get(key) ?? [];
      const recent = prior.filter((t) => t > windowStart);
      if (recent.length >= opts.max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
