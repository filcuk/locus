export {
  AuthHttpError,
  getAccessToken,
  getAuthorizationHeader,
  getSessionUser,
  getValidAccessToken,
  login,
  logout,
  refreshAccessToken,
  register,
  requestPasswordReset,
  setAuthFetchForTests,
  clearSession,
  hasSession,
  readSession,
  type AuthFetch,
} from './client';

export { getOrCreateDeviceId, clearDeviceIdForTests } from './deviceId';

export {
  createMemorySecureStorage,
  setSecureStorageForTests,
  type SecureStorage,
} from './secureStorage';

export {
  persistSession,
  isAccessTokenFresh,
  type StoredSession,
} from './session';
