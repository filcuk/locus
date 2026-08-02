import { DatabaseProvider as WatermelonProvider } from '@nozbe/watermelondb/react';
import type { ReactNode } from 'react';

import { database } from './database';

/**
 * UI reads WatermelonDB observables through this provider.
 * Network I/O stays in `src/sync` (AGENTS §4) — not here.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  return <WatermelonProvider database={database}>{children}</WatermelonProvider>;
}
