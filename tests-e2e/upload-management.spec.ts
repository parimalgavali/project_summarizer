import { test, expect } from '@playwright/test';
import { resetDatabase } from './test-helpers';

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  await page.goto('/');
});

test.describe('Upload Errors', () => {

  test('should upload file', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
    await page.getByLabel('Choose File').setInputFiles('tests-e2e/fixtures/docx_1.txt');
    await page.getByRole('button', { name: 'Upload' }).click();
    const docRow = page.getByRole('row').filter({ hasText: 'docx_1.txt' });
    await expect(docRow).toBeVisible();
    await expect(docRow.getByText('extracted')).toBeVisible({ timeout: 20000 });
  });      

test('should show error for invalid file type', async ({ page }) => {
  await page.getByLabel('Choose File').setInputFiles('tests-e2e/fixtures/test.zip');
  const uploadButton = page.getByRole('button', { name: 'Upload' });
  await expect(uploadButton).toBeEnabled();
  await uploadButton.click();
  await expect(page.getByText('Only PDF, DOCX, TXT allowed.')).toBeVisible();
});

test('should show server-side error for oversized file', async ({ page }) => {
  await page.getByLabel('Choose File').setInputFiles('tests-e2e/fixtures/60mb.pdf');
  const uploadButton = page.getByRole('button', { name: 'Upload' });
  await expect(uploadButton).toBeEnabled();
  await uploadButton.click();
  await expect(page.getByText(/file too large|max 50mb/i)).toBeVisible({ timeout: 10000 });
});  
});
