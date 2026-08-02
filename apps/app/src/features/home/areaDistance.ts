import {
  type AreaGeometry,
  type LatLon,
  AreaGeometrySchema,
  pointInPolygon,
} from '@locus/shared';

/**
 * Own distance for an area row (DESIGN §8 Home).
 * Inside the polygon → `0` ("you are here"). Outside → `+Infinity` until
 * `packages/shared/geometry` exposes polygon-edge distance that client and
 * server can share — parent distance still uses min(own, descendants).
 */
export function areaOwnDistanceMeters(
  fix: LatLon,
  geomGeojson: string,
): number {
  const geometry = parseAreaGeometry(geomGeojson);
  if (!geometry) return Number.POSITIVE_INFINITY;
  if (pointInPolygon(fix, geometry)) return 0;
  // TODO(shared): distance to polygon edge in `@locus/shared` geometry helpers.
  return Number.POSITIVE_INFINITY;
}

export function parseAreaGeometry(geomGeojson: string): AreaGeometry | null {
  try {
    const parsed: unknown = JSON.parse(geomGeojson);
    const result = AreaGeometrySchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
