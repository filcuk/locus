/**
 * Best-effort connectivity without a NetInfo dependency (approval required for new deps).
 * Web: `navigator.onLine` + online/offline events.
 * Native: assume online until the sync driver or a future NetInfo bridge calls `setOnline`.
 */

export type ConnectivityUnsubscribe = () => void;

export function subscribeConnectivity(onChange: (online: boolean) => void): ConnectivityUnsubscribe {
  const nav = typeof globalThis !== 'undefined' ? (globalThis as { navigator?: Navigator }).navigator : undefined;

  if (nav && typeof nav.onLine === 'boolean') {
    onChange(nav.onLine);

    const target = globalThis as unknown as {
      addEventListener?: (type: string, listener: () => void) => void;
      removeEventListener?: (type: string, listener: () => void) => void;
    };

    if (typeof target.addEventListener === 'function' && typeof target.removeEventListener === 'function') {
      const goOnline = (): void => {
        onChange(true);
      };
      const goOffline = (): void => {
        onChange(false);
      };
      target.addEventListener('online', goOnline);
      target.addEventListener('offline', goOffline);
      return () => {
        target.removeEventListener?.('online', goOnline);
        target.removeEventListener?.('offline', goOffline);
      };
    }

    return () => {};
  }

  // No browser connectivity API — start online; driver can force offline via setOnline.
  onChange(true);
  return () => {};
}
