import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../src/services/password.js';

describe('Argon2id password hashing (node:crypto)', () => {
  it('round-trips a password', async () => {
    const encoded = await hashPassword('correct horse battery');
    expect(encoded.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('correct horse battery', encoded)).toBe(true);
    expect(await verifyPassword('wrong password!!', encoded)).toBe(false);
  });
});
