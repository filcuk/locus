/**
 * Default basemap style — OpenFreeMap public instance (DESIGN §6).
 * Operators override via `MAP_STYLE_URL` on the server; the client may receive
 * that value later. Never require an API key for the default.
 */
export const DEFAULT_MAP_STYLE_URL =
  'https://tiles.openfreemap.org/styles/liberty';

let overrideStyleUrl: string | null = null;

export function getMapStyleUrl(): string {
  return overrideStyleUrl ?? DEFAULT_MAP_STYLE_URL;
}

/** Allow tests / future settings to substitute a style without a hardcoded host. */
export function setMapStyleUrl(url: string | null): void {
  overrideStyleUrl = url;
}
