import { useDatabase } from '@nozbe/watermelondb/hooks';
import { type ReactNode, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getValidAccessToken } from '@/auth';

import {
  bindActiveSyncDriver,
  unbindActiveSyncDriver,
} from './activeDriver';
import { createPowerSavingDriver } from './powerSaving';

/**
 * Starts the DESIGN §5 power-saving sync driver while the signed-in app shell
 * is mounted. Tokens come from P1-B single-flight refresh; status hooks are
 * the P1-F defaults on `runSynchronize`.
 */
export function SyncDriverProvider({ children }: { children: ReactNode }) {
  const database = useDatabase();

  useEffect(() => {
    const driver = createPowerSavingDriver({
      database,
      getAccessToken: () => getValidAccessToken(),
      subscribeResume: (onResume) => {
        const onChange = (state: AppStateStatus) => {
          if (state === 'active') onResume();
        };
        const sub = AppState.addEventListener('change', onChange);
        return () => {
          sub.remove();
        };
      },
    });

    bindActiveSyncDriver(driver);
    driver.start();
    void driver.refresh();

    return () => {
      driver.stop();
      unbindActiveSyncDriver(driver);
    };
  }, [database]);

  return <>{children}</>;
}
