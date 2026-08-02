import turfBbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import simplify from '@turf/simplify';

import type { AreaGeometry } from '../schemas/common.js';

/** Derived bbox columns on Area (DESIGN §4) — never the source of truth. */
export type AreaBBox = {
  bbox_min_lon: number;
  bbox_min_lat: number;
  bbox_max_lon: number;
  bbox_max_lat: number;
};

export type LatLon = {
  lat: number;
  lon: number;
};

/** Bbox of a Polygon / MultiPolygon as Area column values. */
export function bboxOf(geometry: AreaGeometry): AreaBBox {
  const [minLon, minLat, maxLon, maxLat] = turfBbox(geometry);
  if (
    minLon === undefined ||
    minLat === undefined ||
    maxLon === undefined ||
    maxLat === undefined
  ) {
    throw new Error('bboxOf: turf returned an incomplete bbox');
  }
  return {
    bbox_min_lon: minLon,
    bbox_min_lat: minLat,
    bbox_max_lon: maxLon,
    bbox_max_lat: maxLat,
  };
}

/**
 * Geometric containment only — not membership.
 * A point inside a polygon does not belong to that area unless `area_id` is set.
 */
export function pointInPolygon(position: LatLon, geometry: AreaGeometry): boolean {
  return booleanPointInPolygon(point([position.lon, position.lat]), geometry);
}

/** Douglas–Peucker simplify; keeps GeoJSON type. High-frequency write path. */
export function simplifyGeometry(
  geometry: AreaGeometry,
  tolerance = 0.00001,
): AreaGeometry {
  const simplified = simplify(geometry, {
    tolerance,
    highQuality: true,
    mutate: false,
  }) as AreaGeometry;
  if (simplified.type !== 'Polygon' && simplified.type !== 'MultiPolygon') {
    throw new Error(`simplifyGeometry: unexpected geometry type`);
  }
  return simplified;
}

/** Great-circle distance in metres (Home ordering and pull filters must agree). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  return distance(point([a.lon, a.lat]), point([b.lon, b.lat]), { units: 'meters' });
}
