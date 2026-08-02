import { useCallback, useState } from 'react';

import type { LocationFix } from './types';

/**
 * One-shot location for Home distance ordering (DESIGN §8).
 * Recompute on screen focus and pull-to-refresh — never continuous tracking.
 *
 * TODO(P1-E): wire `expo-location` (foreground only) once that dependency is
 * approved. Until then the fix stays null and Home falls back to updated_at.
 */
export function useOneShotLocation(): {
  fix: LocationFix;
  refresh: () => Promise<void>;
} {
  const [fix, setFix] = useState<LocationFix>(null);

  const refresh = useCallback(async () => {
    // No GPS dependency in this layer yet — keep null so ordering uses recency.
    setFix(null);
  }, []);

  return { fix, refresh };
}
