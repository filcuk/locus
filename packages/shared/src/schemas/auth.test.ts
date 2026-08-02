import { describe, expect, it } from 'vitest';

import {
  LoginRequestSchema,
  PasswordSchema,
  RegisterRequestSchema,
  RefreshRequestSchema,
} from './auth.js';

const DEVICE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('auth schemas', () => {
  it('accepts a valid register body', () => {
    const parsed = RegisterRequestSchema.parse({
      email: 'user@example.com',
      password: 'long-enough',
      display_name: 'User',
      device_id: DEVICE,
    });
    expect(parsed.email).toBe('user@example.com');
  });

  it('rejects short passwords', () => {
    expect(() => PasswordSchema.parse('short')).toThrow();
  });

  it('requires device_id on login and refresh', () => {
    expect(() =>
      LoginRequestSchema.parse({
        email: 'a@b.co',
        password: 'x',
      }),
    ).toThrow();
    expect(() =>
      RefreshRequestSchema.parse({
        refresh_token: 'tok',
      }),
    ).toThrow();
  });
});
