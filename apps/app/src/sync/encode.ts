/**
 * Convert between DESIGN §5 wire rows (ISO dates, nested geom) and WatermelonDB
 * DirtyRaw (unix-ms dates, string columns only).
 */

import {
  SYNCED_TABLES,
  type SyncChanges,
  type SyncedTable,
} from '@locus/shared';
import type {
  SyncDatabaseChangeSet,
  SyncTableChangeSet,
} from '@nozbe/watermelondb/sync';

/** Client-only columns that must never ride the wire (DESIGN §4 Photos). */
const CLIENT_ONLY_COLUMNS: ReadonlySet<string> = new Set(['local_file_path']);

const ISO_DATE_KEYS: ReadonlySet<string> = new Set([
  'created_at',
  'updated_at',
  'deleted_at',
  'recorded_at',
  'added_at',
  'email_verified_at',
  'visited_at',
  'expires_at',
  'revoked_at',
]);

const WATERMELON_META: ReadonlySet<string> = new Set([
  '_status',
  '_changed',
  '_is_owner',
]);

function isSyncedTable(name: string): name is SyncedTable {
  return (SYNCED_TABLES as readonly string[]).includes(name);
}

function isoToMillis(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function millisToIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && value.length > 0) {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

/** Wire row → WatermelonDB DirtyRaw for applyRemoteChanges. */
export function wireRowToRaw(row: Record<string, unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (CLIENT_ONLY_COLUMNS.has(key)) continue;
    if (key === 'geom_geojson') {
      raw[key] =
        typeof value === 'string' ? value : JSON.stringify(value ?? null);
      continue;
    }
    if (ISO_DATE_KEYS.has(key)) {
      raw[key] = isoToMillis(value);
      continue;
    }
    raw[key] = value === undefined ? null : value;
  }
  return raw;
}

/** WatermelonDB DirtyRaw → wire row for /sync/push. */
export function rawRowToWire(row: Record<string, unknown>): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (WATERMELON_META.has(key) || CLIENT_ONLY_COLUMNS.has(key)) continue;
    if (key === 'geom_geojson') {
      if (typeof value === 'string' && value.length > 0) {
        try {
          wire[key] = JSON.parse(value) as unknown;
        } catch {
          wire[key] = value;
        }
      } else {
        wire[key] = value;
      }
      continue;
    }
    if (ISO_DATE_KEYS.has(key)) {
      const iso = millisToIso(value);
      if (iso !== null) wire[key] = iso;
      continue;
    }
    if (value !== undefined) {
      wire[key] = value;
    }
  }
  return wire;
}

function mapTableToRaw(bag: {
  created: unknown[];
  updated: unknown[];
  deleted: string[];
}): SyncTableChangeSet {
  return {
    created: bag.created.map((row) =>
      wireRowToRaw(row as Record<string, unknown>),
    ),
    updated: bag.updated.map((row) =>
      wireRowToRaw(row as Record<string, unknown>),
    ),
    deleted: bag.deleted,
  };
}

function asMutableChangeSet(): Record<string, SyncTableChangeSet> {
  return {};
}

/** Pull response `changes` → WatermelonDB SyncDatabaseChangeSet. */
export function pullChangesToWatermelon(
  changes: SyncChanges,
): SyncDatabaseChangeSet {
  const out = asMutableChangeSet();
  for (const table of SYNCED_TABLES) {
    out[table] = mapTableToRaw(changes[table]);
  }
  return out as SyncDatabaseChangeSet;
}

function emptyTableBag(): SyncTableChangeSet {
  return { created: [], updated: [], deleted: [] };
}

function isTableChangeSet(value: unknown): value is SyncTableChangeSet {
  if (value === null || typeof value !== 'object') return false;
  const bag = value as SyncTableChangeSet;
  return (
    Array.isArray(bag.created) &&
    Array.isArray(bag.updated) &&
    Array.isArray(bag.deleted)
  );
}

/**
 * Local WatermelonDB changeset → partial SyncChanges for push.
 * Non-synced tables and meta columns are dropped.
 */
export function watermelonChangesToPush(
  changes: SyncDatabaseChangeSet,
): Partial<SyncChanges> {
  // Per-table bags are validated again by SyncPushRequestSchema on the wire.
  const out: Record<string, SyncTableChangeSet> = {};
  const entries = Object.entries(changes as Record<string, unknown>);

  for (const [table, bag] of entries) {
    if (!isSyncedTable(table) || !isTableChangeSet(bag)) continue;
    const mapped: SyncTableChangeSet = {
      created: bag.created.map((row) =>
        rawRowToWire(row as Record<string, unknown>),
      ),
      updated: bag.updated.map((row) =>
        rawRowToWire(row as Record<string, unknown>),
      ),
      deleted: [...bag.deleted],
    };
    const empty =
      mapped.created.length === 0 &&
      mapped.updated.length === 0 &&
      mapped.deleted.length === 0;
    if (empty) continue;
    out[table] = mapped;
  }
  return out as Partial<SyncChanges>;
}

/** Build experimentalRejectedIds from push `rejected` rows. */
export function rejectedIdsFromPush(
  rejected: ReadonlyArray<{ table: string; id: string }>,
): { [tableName: string]: string[] } {
  const map: { [tableName: string]: string[] } = {};
  for (const row of rejected) {
    const list = map[row.table] ?? [];
    list.push(row.id);
    map[row.table] = list;
  }
  return map;
}

export function emptyWatermelonChanges(): SyncDatabaseChangeSet {
  const out = asMutableChangeSet();
  for (const table of SYNCED_TABLES) {
    out[table] = emptyTableBag();
  }
  return out as SyncDatabaseChangeSet;
}
