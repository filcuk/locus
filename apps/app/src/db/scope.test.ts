import { describe, expect, it } from 'vitest';

import { databaseNameForScope } from './scope';

describe('databaseNameForScope', () => {
  it('keeps distinct server and account data in distinct stores', () => {
    expect(
      databaseNameForScope('https://one.example/', 'user-a'),
    ).not.toBe(databaseNameForScope('https://two.example/', 'user-a'));
    expect(
      databaseNameForScope('https://one.example', 'user-a'),
    ).not.toBe(databaseNameForScope('https://one.example', 'user-b'));
  });

  it('is stable and does not expose the server URL', () => {
    const name = databaseNameForScope('https://private.example/path', 'user-a');
    expect(name).toBe(
      databaseNameForScope('https://private.example/path/', 'user-a'),
    );
    expect(name).not.toContain('private.example');
    expect(name).toMatch(/^locus-[0-9a-f]{8}$/);
  });
});
