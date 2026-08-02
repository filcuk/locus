import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const routesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/routes');

/** Patterns that indicate a route bypassed `can` / `assertCan`. */
const FORBIDDEN = [
  /ownerId\s*!==/,
  /owner_id\s*!==/,
  /\.ownerId\s*===/,
  /place\.ownerId/,
  /resource\.ownerId\s*!==/,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('route handlers must not inline ownership checks', () => {
  it('scans apps/api/src/routes for forbidden ownership comparisons', () => {
    const files = walk(routesDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(src, `${path.basename(file)} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
