/**
 * Fallback when platform extensions are not resolved (e.g. some test runners).
 * Metro prefers `MapView.native.tsx` / `MapView.web.tsx` at bundle time.
 */
export { MapView } from './MapView.web';
