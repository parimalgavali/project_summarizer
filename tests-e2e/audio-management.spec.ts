import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument, setupAudioDirectlyFromDoc } from './test-helpers';

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  const documentId = await setupDocument(request, 'docx_1.txt');
  await setupAudioDirectlyFromDoc(request, documentId);
  await page.goto('/');
  await page.getByRole('button', { name: 'Audio' }).click();
  await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();
});

test.describe('Audio Management', () => {

  test('should download an audio file', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: 'bullet_points' });
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('summary_audio_');
    expect(download.suggestedFilename()).toContain('.mp3');
  });

  test('should delete an audio file', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'bullet_points' });
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).not.toBeVisible();
  });
  
});