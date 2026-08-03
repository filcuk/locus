import { describe, expect, it } from 'vitest';

import { AuthHttpError } from './client';
import { messageForAuthError, safeServerMessage } from './authErrors';

const copy = {
  known: {
    email_taken: 'That email is already registered.',
  },
  network: 'Could not reach the server.',
  generic: 'Something went wrong. Try again.',
};

describe('safeServerMessage', () => {
  it('accepts short plain messages', () => {
    expect(safeServerMessage('Instance is full')).toBe('Instance is full');
  });

  it('rejects Zod dumps, secrets, and overlong text', () => {
    expect(safeServerMessage('[{"code":"invalid_type"}]')).toBeNull();
    expect(safeServerMessage('bad refresh_token value')).toBeNull();
    expect(safeServerMessage('x'.repeat(200))).toBeNull();
  });
});

describe('messageForAuthError', () => {
  it('maps known codes', () => {
    expect(
      messageForAuthError(new AuthHttpError(409, 'email_taken'), copy),
    ).toBe('That email is already registered.');
  });

  it('surfaces a safe server message for unknown codes', () => {
    expect(
      messageForAuthError(
        new AuthHttpError(503, 'upstream', 'Instance is full'),
        copy,
      ),
    ).toBe('Instance is full');
  });

  it('maps network TypeErrors', () => {
    expect(
      messageForAuthError(new TypeError('Network request failed'), copy),
    ).toBe('Could not reach the server.');
  });

  it('falls back to generic', () => {
    expect(messageForAuthError(new Error('boom'), copy)).toBe(
      'Something went wrong. Try again.',
    );
  });
});
