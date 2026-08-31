/**
 * Sync uses the auth-owned SecureStorage device ID so auth sessions and
 * ChangeLog echo suppression always identify the same installation.
 */
import { getSecureStorage } from '../auth/secureStorage';

export {
  clearDeviceIdForTests as clearDeviceId,
  getOrCreateDeviceId as getDeviceId,
} from '../auth/deviceId';

export async function setDeviceId(id: string): Promise<void> {
  await getSecureStorage().setItem('locus.deviceId', id);
}
