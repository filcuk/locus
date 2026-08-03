/**
 * Per-install device_id for sessions and sync echo suppression (DESIGN §5).
 * Survives logout; a reinstall wipes SecureStore / localStorage and gets a new id.
 */

import { newEntityId } from '@locus/shared';

import { getSecureStorage } from './secureStorage';

const DEVICE_ID_KEY = 'locus.deviceId';

export async function getOrCreateDeviceId(): Promise<string> {
  const storage = getSecureStorage();
  const existing = await storage.getItem(DEVICE_ID_KEY);
  if (existing !== null && existing.length > 0) {
    return existing;
  }
  const id = newEntityId();
  await storage.setItem(DEVICE_ID_KEY, id);
  return id;
}

/** Test helper — does not clear tokens. */
export async function clearDeviceIdForTests(): Promise<void> {
  await getSecureStorage().deleteItem(DEVICE_ID_KEY);
}
