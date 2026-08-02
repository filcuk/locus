import { expect, test } from '@playwright/test';

test('server-setup is the first screen and accepts a user-supplied URL', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Prefer role/text — RN web may not always surface testID as data-testid.
  await expect(page.getByText('Server URL').first()).toBeVisible({ timeout: 60_000 });

  const input = page.getByPlaceholder('https://locus.example.com');
  await input.fill('http://127.0.0.1:8000');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Sign in').first()).toBeVisible();
});
