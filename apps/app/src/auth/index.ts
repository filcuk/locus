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
} from './client.js';

export { getOrCreateDeviceId, clearDeviceIdForTests } from './deviceId.js';

export {
  createMemorySecureStorage,
  setSecureStorageForTests,
  type SecureStorage,
} from './secureStorage.js';

export {
  persistSession,
  isAccessTokenFresh,
  type StoredSession,
} from './session.js';
