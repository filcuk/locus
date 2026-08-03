/** Normalize Postgres timestamptz values to ISO-8601 with offset for Zod. */
export function toIsoDateTime(value: string | Date): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('invalid timestamp from database');
  }
  return parsed.toISOString();
}
