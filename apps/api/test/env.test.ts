import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_POLYGON_MAX_VERTICES_PER_RING,
  DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG,
} from '@locus/shared';

import { loadEnv, resetEnvForTests } from '../src/env.js';

const BASE = {
  SECRET_KEY: 'test-secret',
  MEDIA_ROOT: '/tmp/locus-env-test-media',
};

describe('loadEnv polygon limits (DESIGN §7)', () => {
  afterEach(() => {
    resetEnvForTests();
  });

  it('defaults polygon env to shared constants when unset', () => {
    const env = loadEnv({ ...BASE });
    expect(env.POLYGON_MAX_VERTICES_PER_RING).toBe(DEFAULT_POLYGON_MAX_VERTICES_PER_RING);
    expect(env.POLYGON_SIMPLIFY_TOLERANCE_DEG).toBe(DEFAULT_POLYGON_SIMPLIFY_TOLERANCE_DEG);
  });

  it('parses operator overrides', () => {
    const env = loadEnv({
      ...BASE,
      POLYGON_MAX_VERTICES_PER_RING: '64',
      POLYGON_SIMPLIFY_TOLERANCE_DEG: '0.0001',
    });
    expect(env.POLYGON_MAX_VERTICES_PER_RING).toBe(64);
    expect(env.POLYGON_SIMPLIFY_TOLERANCE_DEG).toBe(0.0001);
  });

  it('rejects non-positive polygon limits', () => {
    expect(() =>
      loadEnv({
        ...BASE,
        POLYGON_MAX_VERTICES_PER_RING: '0',
      }),
    ).toThrow(/Invalid environment/);
  });
});
