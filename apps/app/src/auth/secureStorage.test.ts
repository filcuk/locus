import { describe, expect, it } from 'vitest';

import {
  createMemorySecureStorage,
  getSecureStorage,
  setSecureStorageForTests,
} from './secureStorage';

describe('secureStorage entry', () => {
  it('exports a callable getSecureStorage (must not be shadowed by platform files)', () => {
    expect(typeof getSecureStorage).toBe('function');
    setSecureStorageForTests(createMemorySecureStorage());
    const storage = getSecureStorage();
    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.deleteItem).toBe('function');
    setSecureStorageForTests(null);
  });
});
