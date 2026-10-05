import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument, setupSummary, setupApproval } from './test-helpers';

let documentId: string;
let pendingSummaryId: string;
let approvedSummaryId: string;

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  documentId = await setupDocument(request, 'docx_1.txt');
  pendingSummaryId = await setupSummary(request, documentId, 'academic_tone'); 
  approvedSummaryId = await setupSummary(request, documentId, 'bullet_points');
  await setupApproval(request, approvedSummaryId, 'approved');
  await page.goto('/');
  await page.getByRole('button', { name: 'Summaries', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Summaries' })).toBeVisible();
});

test.describe('Summary Management', () => {

  test('should download an approved summary', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: 'bullet_points' });
    const downloadPromise = page.waitForEvent('download');
    await row.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('summary_');
    expect(download.suggestedFilename()).toContain('.txt');
  });

  test('should delete an approved summary', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: 'bullet_points' });
    page.on('dialog', dialog => dialog.accept());
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).not.toBeVisible();
    await expect(page.getByText('academic_tone')).toBeVisible();;
  });

});