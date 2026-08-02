/** Normalize Postgres timestamptz strings to ISO-8601 with offset for Zod. */
export function toIsoDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('invalid timestamp from database');
  }
  return parsed.toISOString();
}
