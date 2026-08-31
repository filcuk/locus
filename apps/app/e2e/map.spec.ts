import { expect, test } from '@playwright/test';
import path from 'node:path';

test('web map renders OpenFreeMap with visible OSM attribution', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await expect(page.getByText('Server URL').first()).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder('https://locus.example.com').fill('http://127.0.0.1:8000');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Sign in').first()).toBeVisible();

  // Tile requests keep the network busy — do not wait for networkidle on map routes.
  await page.goto('/map');
  await expect(page.getByTestId('map-screen')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('map-attribution')).toBeVisible();
  await expect(page.getByTestId('map-attribution')).toContainText('OpenStreetMap');

  await expect(page.getByTestId('maplibre-canvas')).toBeVisible({ timeout: 60_000 });
  // Allow MapLibre to paint tiles before capturing evidence.
  await page.waitForTimeout(4_000);

  const evidenceDir = path.join(__dirname, 'evidence');
  await page.screenshot({
    path: path.join(evidenceDir, 'map-web.png'),
    fullPage: false,
  });
});
