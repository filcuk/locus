import { defineConfig } from '@playwright/test';

const port = Number(process.env['LOCUS_E2E_PORT'] ?? '19006');
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec expo start --web --port ${port} --clear`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
