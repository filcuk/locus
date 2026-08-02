export type ParsedCoords =
  | { ok: true; lat: number; lon: number }
  | { ok: false };

/** Parse manual lat/lon text fields; rejects empty, NaN, and out-of-range values. */
export function parseCoords(latText: string, lonText: string): ParsedCoords {
  const latRaw = latText.trim();
  const lonRaw = lonText.trim();
  if (latRaw.length === 0 || lonRaw.length === 0) {
    return { ok: false };
  }
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false };
  }
  return { ok: true, lat, lon };
}
