import { useCallback, useState } from 'react';

import { requestOneShotFix } from './requestOneShotFix';
import type { LocationFix } from './types';

/**
 * One-shot location for Home distance ordering (DESIGN §8).
 * Recompute on screen focus and pull-to-refresh — never continuous tracking.
 */
export function useOneShotLocation(): {
  fix: LocationFix;
  refresh: () => Promise<void>;
} {
  const [fix, setFix] = useState<LocationFix>(null);

  const refresh = useCallback(async () => {
    try {
      setFix(await requestOneShotFix());
    } catch {
      // Denied mid-request, unavailable provider, or timeout — fall back to recency.
      setFix(null);
    }
  }, []);

  return { fix, refresh };
}
