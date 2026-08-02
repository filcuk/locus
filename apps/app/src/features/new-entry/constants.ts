/**
 * Temporary owner until P1-B exposes the signed-in user id to local writers.
 * Not a sync credential — only stamps WatermelonDB `owner_id` for offline rows.
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
