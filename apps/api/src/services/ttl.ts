/**
 * Parse DESIGN §7 TTL strings such as `15m`, `720h`, `30d`, or bare seconds.
 * Returns duration in whole seconds.
 */
export function parseTtlToSeconds(raw: string): number {
  const trimmed = raw.trim();
  const match = /^(\d+)([smhd])?$/u.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid TTL: ${raw}`);
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  switch (unit) {
    case 's':
      return amount;
    case 'm':
      return amount * 60;
    case 'h':
      return amount * 3600;
    case 'd':
      return amount * 86400;
    default:
      throw new Error(`Invalid TTL unit: ${raw}`);
  }
}

export function secondsFromNowIso(seconds: number, now = new Date()): string {
  return new Date(now.getTime() + seconds * 1000).toISOString();
}
