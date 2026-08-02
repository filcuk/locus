import type { LatLon } from '@locus/shared';

export type EntryKind = 'area' | 'place' | 'point';

/** Plain row used by Home hierarchy ordering (no WatermelonDB types). */
export type EntryRecord = {
  id: string;
  kind: EntryKind;
  title: string;
  /** Unix ms — WatermelonDB `updated_at`. */
  updatedAt: number;
  lat: number | null;
  lon: number | null;
  /** Place → area; point → area (direct only). */
  areaId: string | null;
  /** Point → place. */
  placeId: string | null;
  /** Area geometry JSON string; null for place/point. */
  geomGeojson: string | null;
};

export type HierarchyNode = {
  record: EntryRecord;
  children: HierarchyNode[];
  /**
   * Metres to nearest contained thing when a fix is available.
   * `null` when sorting by recency (no fix).
   */
  distanceMeters: number | null;
  /** Area with fix inside its polygon (DESIGN §8). */
  youAreHere: boolean;
};

export type LocationFix = LatLon | null;
