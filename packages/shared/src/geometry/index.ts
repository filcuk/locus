import turfBbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import distance from '@turf/distance';
import { point } from '@turf/helpers';
import simplify from '@turf/simplify';

import type { AreaGeometry } from '../schemas/common.js';

/** Default max unique vertices per ring (DESIGN §4 / §13). */
export const DEFAULT_POLYGON_MAX_VERTICES_PER_RING = 128;

/** Default Douglas–Peucker tolerance in degrees WGS84 (~5 m) (DESIGN §4 / §13). */
export const DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG = 0.00005;

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

type LonLat = [number, number];

export type PrepareAreaGeometryOptions = {
  maxVerticesPerRing?: number;
  simplifyToleranceDeg?: number;
};

export type PrepareAreaGeometryOk = {
  ok: true;
  geometry: AreaGeometry;
};

export type PrepareAreaGeometryFail = {
  ok: false;
  code: 'TOO_MANY_VERTICES';
  message: string;
  maxVerticesPerRing: number;
  ringVertexCount: number;
};

export type PrepareAreaGeometryResult = PrepareAreaGeometryOk | PrepareAreaGeometryFail;

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
  tolerance: number = DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG,
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

/**
 * Unique vertices in a GeoJSON ring (excludes the closing duplicate when present).
 */
export function countRingVertices(ring: LonLat[]): number {
  if (ring.length === 0) return 0;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (
    ring.length >= 2 &&
    first !== undefined &&
    last !== undefined &&
    first[0] === last[0] &&
    first[1] === last[1]
  ) {
    return ring.length - 1;
  }
  return ring.length;
}

/** Max unique-vertex count across all rings in a Polygon / MultiPolygon. */
export function maxRingVertexCount(geometry: AreaGeometry): number {
  let max = 0;
  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      max = Math.max(max, countRingVertices(ring));
    }
  } else {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        max = Math.max(max, countRingVertices(ring));
      }
    }
  }
  return max;
}

/**
 * Simplify then enforce the per-ring vertex cap (DESIGN §4).
 * Returns the simplified geometry when within limits; rejects when still over cap.
 */
export function prepareAreaGeometry(
  geometry: AreaGeometry,
  options: PrepareAreaGeometryOptions = {},
): PrepareAreaGeometryResult {
  const maxVerticesPerRing =
    options.maxVerticesPerRing ?? DEFAULT_POLYGON_MAX_VERTICES_PER_RING;
  const simplifyToleranceDeg =
    options.simplifyToleranceDeg ?? DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG;

  const simplified = simplifyGeometry(geometry, simplifyToleranceDeg);
  const ringVertexCount = maxRingVertexCount(simplified);

  if (ringVertexCount > maxVerticesPerRing) {
    return {
      ok: false,
      code: 'TOO_MANY_VERTICES',
      message: `Polygon ring has ${ringVertexCount} vertices; max is ${maxVerticesPerRing} after simplify`,
      maxVerticesPerRing,
      ringVertexCount,
    };
  }

  return { ok: true, geometry: simplified };
}

/** Great-circle distance in metres (Home ordering and pull filters must agree). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  return distance(point([a.lon, a.lat]), point([b.lon, b.lat]), { units: 'meters' });
}
