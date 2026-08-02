/**
 * Local-only API launcher: sets required env defaults and runs the API watcher.
 * SECRET_KEY here is for maintainer machines only — never use in production.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');
const mediaRoot = join(root, '.data', 'media');
const tsxCli = createRequire(join(apiDir, 'package.json')).resolve('tsx/cli');

mkdirSync(mediaRoot, { recursive: true });

process.env['SECRET_KEY'] ??= 'dev-secret-local-only';
process.env['MEDIA_ROOT'] ??= mediaRoot;

const child = spawn(process.execPath, [tsxCli, 'watch', 'src/index.ts'], {
  cwd: apiDir,
  env: process.env,
  stdio: 'inherit',
});

const forward = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => forward('SIGINT'));
process.on('SIGTERM', () => forward('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
