import { DatabaseProvider as WatermelonProvider } from '@nozbe/watermelondb/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { createDatabase } from './database';

/**
 * UI reads WatermelonDB observables through this provider.
 * Network I/O stays in `src/sync` (AGENTS §4) — not here.
 */
export function DatabaseProvider({
  children,
  databaseName,
}: {
  children: ReactNode;
  databaseName: string;
}) {
  const database = useMemo(() => createDatabase(databaseName), [databaseName]);
  return (
    <WatermelonProvider key={databaseName} database={database}>
      {children}
    </WatermelonProvider>
  );
}
