/**
 * WatermelonDB has no foreign keys or CHECK constraints, so DESIGN §4
 * containment rules live here and must run on every local write that sets
 * parent ids.
 */

export type PointParents = {
  placeId: string | null | undefined;
  areaId: string | null | undefined;
};

/** A point belongs to a place **or** an area, never both (DESIGN §4). */
export function isValidPointContainment(parents: PointParents): boolean {
  const hasPlace = parents.placeId != null && parents.placeId.length > 0;
  const hasArea = parents.areaId != null && parents.areaId.length > 0;
  return !(hasPlace && hasArea);
}

export function assertPointContainment(parents: PointParents): void {
  if (!isValidPointContainment(parents)) {
    throw new Error('A point may belong to a place or an area, never both');
  }
}

/** Serialise area geometry for the `geom_geojson` string column. */
export function serializeGeomGeojson(geometry: unknown): string {
  return JSON.stringify(geometry);
}

/** Parse a stored `geom_geojson` string back to a plain object. */
export function parseGeomGeojson(raw: string): unknown {
  return JSON.parse(raw) as unknown;
}
