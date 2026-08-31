export {
  AUTH_REQUEST_TIMEOUT_MS,
  AUTH_RETRY_BACKOFF_MS,
  AUTH_TRANSPORT_RETRIES,
  AuthHttpError,
  AuthCancelledError,
  AuthTimeoutError,
  getAccessToken,
  getAuthorizationHeader,
  getSessionUser,
  getValidAccessToken,
  login,
  logout,
  refreshAccessToken,
  register,
  requestPasswordReset,
  probeServer,
  setAuthFetchForTests,
  clearSession,
  hasSession,
  readSession,
  type AuthFetch,
  type AuthProgress,
  type ClientOptions,
} from './client';

export {
  isAuthCancelled,
  messageForAuthError,
  safeServerMessage,
} from './authErrors';

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
