import * as Location from 'expo-location';

import type { LocationFix } from './types';

/**
 * Foreground one-shot fix for Home distance ordering (DESIGN §8 / §13).
 * Requests permission at use; never starts background or continuous tracking.
 */
export async function requestOneShotFix(): Promise<LocationFix> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
  };
}
