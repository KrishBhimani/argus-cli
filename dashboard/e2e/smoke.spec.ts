import { test, expect } from '@playwright/test';

const routes: [string, string][] = [
  ['/', 'Overview'], ['/alerts', 'Alerts'], ['/sessions', 'Sessions'], ['/tools', 'Tools'], ['/models', 'Models'],
  ['/trends', 'Trends'], ['/search', 'Transcripts'], ['/budgets', 'Budgets'], ['/settings', 'Settings'],
];

for (const [path, crumb] of routes) {
  test(`renders ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.getByText('ARGUS', { exact: true })).toBeVisible();
    await expect(page.locator('b', { hasText: crumb }).first()).toBeVisible();
    // Give queries a moment to settle so render-time errors surface.
    await page.waitForTimeout(800);
    expect(errors).toEqual([]);
  });
}

test('deep link survives refresh and legacy URLs redirect', async ({ page }) => {
  await page.goto('/sessions/claude_code%3Adoes-not-exist');
  await expect(page.getByText('ARGUS', { exact: true })).toBeVisible(); // served index.html, not a 404 page
  await page.goto('/prompts');
  await expect(page).toHaveURL(/\/search$/);
  await page.goto('/session?id=claude_code%3Aabc');
  await expect(page).toHaveURL(/\/sessions\/claude_code%3Aabc/);
});

test('command palette opens with Ctrl+K', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('ARGUS', { exact: true })).toBeVisible(); // shell mounted (routes are code-split)
  await page.keyboard.press('Control+K');
  await expect(page.getByPlaceholder(/jump to/i)).toBeVisible();
});
