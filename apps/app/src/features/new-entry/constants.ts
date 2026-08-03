/**
 * Fallback owner stamp when no session user is available (unit tests / edge).
 * Production signed-in writes should resolve `getSessionUser().id` instead.
 */
export const LOCAL_OWNER_PLACEHOLDER =
  '00000000-0000-4000-8000-000000000001';

/** Null Island — obvious non-GPS placeholder when the user skips manual coords. */
export const PLACEHOLDER_COORDS = {
  lat: 0,
  lon: 0,
} as const;

export const POSITION_SOURCE_MANUAL = 'manual';
export const POSITION_SOURCE_PLACEHOLDER = 'placeholder';
