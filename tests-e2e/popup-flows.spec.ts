import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument } from './test-helpers';

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  await setupDocument(request, 'docx_1.txt');
  await page.goto('/');
  // Click the Summaries tab
  await page.getByRole('button', { name: 'Summaries' }).first().click();
  await page.getByRole('button', { name: 'Generate Summary' }).click();
  await page.getByRole('heading', { name: 'Select Document' }).waitFor();
  await page.getByRole('button', { name: /docx_1.txt/ }).click();
  await page.getByRole('heading', { name: 'Choose Summary Format', level: 2 }).waitFor();
  await page.getByRole('button', { name: 'Generate Summary' }).last().click();
  await page.getByRole('heading', { name: 'Summary Preview', level: 2 }).waitFor({ timeout: 20000 });
});

test.describe('Generate Summary Model Flows', () => {

  test('should reject a summary from the preview model', async ({ page }) => {
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('heading', { name: 'Summary Preview', level: 2 })).not.toBeVisible();
    await expect(page.getByText('No summaries available.')).toBeVisible();
  });

  test('should regenerate a summary from the preview model', async ({ page }) => {
    const originalText = await page.locator('div[style*="white-space: pre-wrap"]').textContent();
    await page.getByRole('button', { name: 'Regenerate' }).click();
    await expect(page.getByRole('heading', { name: 'Choose Summary Format', level: 2 })).toBeVisible();
    await page.getByLabel('Bullet Points').click();
    await page.getByRole('button', { name: 'Generate Summary' }).last().click();
    await expect(page.getByRole('heading', { name: 'Summary Preview', level: 2 })).toBeVisible({ timeout: 20000 });
    const newText = await page.locator('div[style*="white-space: pre-wrap"]').textContent();
    expect(newText).not.toEqual(originalText);
    await expect(page.getByText('Format: Bullet Points')).toBeVisible();
  });
  
});
