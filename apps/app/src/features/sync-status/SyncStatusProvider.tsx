import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { subscribeConnectivity } from './connectivity.js';
import { syncStatusController } from './controller.js';
import { SyncStatusIndicator } from './SyncStatusIndicator.js';
import type { SyncStatusSnapshot } from './types.js';

/**
 * Owns connectivity subscription and mounts the indicator in app chrome.
 * Wired from root `_layout` so `(app)/_layout` stays free for other P1 layers.
 */
export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot>(() => syncStatusController.getSnapshot());

  useEffect(() => {
    const unsubStatus = syncStatusController.subscribe(setSnapshot);
    const unsubNet = subscribeConnectivity((online) => {
      syncStatusController.setOnline(online);
    });
    return () => {
      unsubStatus();
      unsubNet();
    };
  }, []);

  return (
    <View style={styles.root}>
      {children}
      <View style={styles.chrome} pointerEvents="box-none">
        <SyncStatusIndicator state={snapshot.state} errorDetail={snapshot.lastError} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  chrome: {
    position: 'absolute',
    top: 52,
    right: 12,
    zIndex: 50,
  },
});
