import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const metroConfig = require('../metro.config.js') as {
  watchFolders?: string[];
};
const sharedDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/shared',
);

describe('Metro workspace watching', () => {
  it('watches only the shared source package outside the app', () => {
    expect(metroConfig.watchFolders).toEqual([sharedDirectory]);
  });
});
