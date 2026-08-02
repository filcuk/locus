#!/usr/bin/env node
/**
 * Fails the build when an installed dependency carries a licence that is not on
 * the allow-list in `.cursor/rules/licensing.mdc`. Locus ships under Apache-2.0,
 * so copyleft and source-available licences are a maintainer decision, never a
 * silent addition.
 */
import { spawnSync } from 'node:child_process';

/** SPDX identifiers from `.cursor/rules/licensing.mdc`. Adding one is a maintainer decision. */
const ALLOWED = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  'Unlicense',
  'CC0-1.0',
  'Zlib',
  'Python-2.0',
  'BlueOak-1.0.0',
  '0BSD',
  'CC-BY-4.0',
  'MPL-2.0',
  // SQLite blessing — public-domain dedication; see https://www.sqlite.org/copyright.html
  'blessing',
]);

/**
 * Packages whose npm metadata omits a licence but whose upstream licence we verified
 * and the maintainer approved (do not grow this without an explicit allow).
 */
const PACKAGE_LICENCE_OVERRIDES = new Map([
  // WatermelonDB ships a SQLite amalgamation mirror with no package.json licence field.
  ['@nozbe/sqlite', 'blessing'],
]);

/**
 * Accepts an SPDX expression when it resolves to something on the allow-list:
 * every operand of an AND must be allowed, at least one operand of an OR must be.
 */
function isAllowed(expression) {
  const trimmed = expression.trim().replace(/^\((.*)\)$/s, '$1').trim();
  if (/\sOR\s/i.test(trimmed)) {
    return trimmed.split(/\sOR\s/i).some(isAllowed);
  }
  if (/\sAND\s/i.test(trimmed)) {
    return trimmed.split(/\sAND\s/i).every(isAllowed);
  }
  return ALLOWED.has(trimmed.replace(/\+$/, ''));
}

function readInstalledLicences() {
  const pnpmEntry = process.env['npm_execpath'];
  const args = ['licenses', 'list', '--json', '--recursive'];
  const result = pnpmEntry
    ? spawnSync(process.execPath, [pnpmEntry, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    : spawnSync('pnpm', args, { encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 });

  const stdout = result.stdout?.trim() ?? '';
  // pnpm exits non-zero when there is nothing installed to inspect, which is not a failure here.
  if (!stdout) {
    if (result.status !== 0) {
      process.stderr.write(result.stderr ?? '');
      throw new Error(`pnpm licenses list exited with ${result.status}`);
    }
    return {};
  }
  return JSON.parse(stdout);
}

const byLicence = readInstalledLicences();
const offenders = [];

for (const [licence, packages] of Object.entries(byLicence)) {
  for (const pkg of packages) {
    const effective = PACKAGE_LICENCE_OVERRIDES.get(pkg.name) ?? licence;
    if (isAllowed(effective)) continue;
    offenders.push({ name: pkg.name, versions: pkg.versions?.join(', ') ?? '', licence });
  }
}

if (offenders.length === 0) {
  const count = Object.values(byLicence).reduce((total, packages) => total + packages.length, 0);
  console.log(`Licence check passed: ${count} package(s), all on the allow-list.`);
  process.exit(0);
}

console.error('Licence check failed. These packages are not on the allow-list:\n');
for (const { name, versions, licence } of offenders.sort((a, b) => a.name.localeCompare(b.name))) {
  console.error(`  ${name}@${versions} — ${licence}`);
}
console.error(
  '\nAllowed: ' +
    [...ALLOWED].join(', ') +
    '\nAsk the maintainer before adding anything else (.cursor/rules/licensing.mdc).',
);
process.exit(1);
