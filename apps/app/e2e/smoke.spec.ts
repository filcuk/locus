import { expect, test } from '@playwright/test';

test('server-setup is the first screen and accepts a user-supplied URL', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Prefer role/text — RN web may not always surface testID as data-testid.
  await expect(page.getByText('Server URL').first()).toBeVisible({ timeout: 60_000 });

  const input = page.getByPlaceholder('https://locus.example.com');
  await input.fill('http://127.0.0.1:8000');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Sign in').first()).toBeVisible();
});

test('shows the target and allows cancelling a connection attempt', async ({ page }) => {
  await page.route('http://127.0.0.1:8000/health', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByPlaceholder('https://locus.example.com').fill('http://127.0.0.1:8000');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByTestId('connection-progress')).toBeVisible();
  await expect(page.getByTestId('connection-target')).toContainText(
    'http://127.0.0.1:8000',
  );
  await page.getByTestId('connection-cancel').click();

  await expect(page.getByTestId('server-setup')).toBeVisible();
  await expect(page.getByTestId('connection-progress')).toHaveCount(0);
});
