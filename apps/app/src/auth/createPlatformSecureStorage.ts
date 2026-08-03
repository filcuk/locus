/**
 * Vitest / tsc fallback when Metro platform extensions are not applied.
 * Metro on device resolves `createPlatformSecureStorage.native.ts` /
 * `createPlatformSecureStorage.web.ts` instead.
 */
export { createPlatformSecureStorage } from './createPlatformSecureStorage.web';
