import { afterEach, describe, expect, it } from 'vitest';

import {
  clearServerUrl,
  getServerUrl,
  hasServerUrl,
  isValidServerUrl,
  setServerUrl,
} from './server-url';

afterEach(() => {
  clearServerUrl();
});

describe('server-url', () => {
  it('rejects non-http(s) values', () => {
    expect(isValidServerUrl('not-a-url')).toBe(false);
    expect(isValidServerUrl('ftp://example.com')).toBe(false);
    expect(isValidServerUrl('https://example.com')).toBe(true);
    expect(isValidServerUrl('http://localhost:8000')).toBe(true);
  });

  it('stores and returns a trimmed URL without a trailing slash', () => {
    setServerUrl(' https://example.com/ ');
    expect(getServerUrl()).toBe('https://example.com');
    expect(hasServerUrl()).toBe(true);
  });

  it('starts empty — no baked-in instance', () => {
    expect(getServerUrl()).toBeNull();
    expect(hasServerUrl()).toBe(false);
  });
});
