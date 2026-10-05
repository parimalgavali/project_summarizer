import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument } from './test-helpers';


test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  // Create two documents so we can test search and delete
  await setupDocument(request, 'docx_1.txt');
  await setupDocument(request, 'docx_2.txt');
  await page.goto('/');
});

test.describe('Document Management', () => {
  
  test('should search for a document', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('docx_1.txt')).toBeVisible();
    await expect(page.getByText('docx_2.txt')).toBeVisible();    
    await page.getByPlaceholder('Search documents...').fill('docx_2'); // Search for "docx_2.txt"
    await expect(page.getByText('docx_1.txt')).not.toBeVisible();
    await expect(page.getByText('docx_2.txt')).toBeVisible();
  });

  test('should delete a document', async ({ page }) => {
    await page.goto('/');
    page.on('dialog', dialog => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'docx_1.txt' });
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('docx_1.txt')).not.toBeVisible();
    await expect(page.getByText('docx_2.txt')).toBeVisible();
  });

});