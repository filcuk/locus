import { expect, test } from '@playwright/test';

test('server-setup is the first screen and accepts a user-supplied URL', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('server-setup')).toBeVisible();
  await expect(page.getByText('Server URL')).toBeVisible();

  await page.getByTestId('server-url-input').fill('http://127.0.0.1:8000');
  await page.getByTestId('server-url-save').click();

  await expect(page.getByText('Sign in')).toBeVisible();
});
