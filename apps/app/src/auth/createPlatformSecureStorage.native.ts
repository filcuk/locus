/**
 * Native Keychain / Keystore persistence via expo-secure-store.
 */

import * as SecureStore from 'expo-secure-store';

import type { SecureStorage } from './secureStorageTypes';

export function createPlatformSecureStorage(): SecureStorage {
  return {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    deleteItem: (key) => SecureStore.deleteItemAsync(key),
  };
}
