/**
 * Local search over entries the sync pull already scoped to this viewer
 * (DESIGN §4 / §5). Private (`user`-scoped) tags stay owner-only (DESIGN §4 §8).
 */

import type {
  SearchMatchField,
  SearchableRecord,
  SearchResult,
  TagVisibilityInput,
} from './types';

/** System tags for everyone; `user` tags only for their owner (DESIGN §4). */
export function isTagVisibleToViewer(
  tag: TagVisibilityInput,
  viewerId: string | null,
): boolean {
  if (tag.scope === 'system') return true;
  if (tag.scope === 'user') {
    return viewerId !== null && tag.ownerId === viewerId;
  }
  return false;
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase().includes(needle);
}

function matchFieldFor(
  record: SearchableRecord,
  needle: string,
): SearchMatchField | null {
  if (includesInsensitive(record.title, needle)) return 'title';
  if (
    record.description !== null &&
    includesInsensitive(record.description, needle)
  ) {
    return 'description';
  }
  for (const label of record.tagLabels) {
    if (includesInsensitive(label, needle)) return 'tag';
  }
  return null;
}

/**
 * Case-insensitive substring match on title, description, then visible tags.
 * Empty / whitespace-only query ⇒ no results (do not dump the whole store).
 * Order: most recently updated, then title (Home's no-fix fallback).
 */
export function matchSearch(
  records: readonly SearchableRecord[],
  query: string,
): SearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle.length === 0) return [];

  const hits: SearchResult[] = [];
  for (const record of records) {
    const matchField = matchFieldFor(record, needle);
    if (matchField === null) continue;
    hits.push({ ...record, matchField });
  }

  hits.sort((a, b) => {
    if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
    return a.title.localeCompare(b.title);
  });
  return hits;
}
