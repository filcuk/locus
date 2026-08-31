/**
 * Derive a stable, non-sensitive Watermelon database name from the server
 * origin and account. The URL never appears in a filename or diagnostic.
 */
export function databaseNameForScope(
  serverUrl: string,
  accountId: string,
): string {
  const canonicalUrl = serverUrl.trim().replace(/\/+$/, '');
  const input = `${canonicalUrl}\u0000${accountId}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `locus-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
