import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument, setupAudioDirectlyFromDoc, API_BASE } from './test-helpers';

let audioId: string;

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  const documentId = await setupDocument(request, 'docx_1.txt');
  audioId = await setupAudioDirectlyFromDoc(request, documentId);
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
    expect(download.suggestedFilename()).toMatch(/\.(mp3|aiff)$/);
  });

  test('download endpoint should return the audio file', async ({ request }) => {
    const response = await request.get(`${API_BASE}/audios/${audioId}/download`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^audio\//);
    expect(response.headers()['content-disposition']).toContain(`summary_audio_${audioId}`);
    expect((await response.body()).length).toBeGreaterThan(0);
  });

  test('should delete an audio file', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept());
    const row = page.getByRole('row').filter({ hasText: 'bullet_points' });
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).not.toBeVisible();
  });
  
});