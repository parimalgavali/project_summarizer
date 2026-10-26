import { test, expect } from '@playwright/test';
import { resetDatabase, setupDocument, setupSummary } from './test-helpers';

test.beforeEach(async ({ request, page }) => {
  await resetDatabase(request);
  const docId = await setupDocument(request, 'docx_1.txt');
  await setupSummary(request, docId, 'short_text');
  await setupDocument(request, 'docx_2.txt');
  await page.goto('/');
});

test.describe('Semantic Search', () => {
  test('should rank matching documents and open their summaries', async ({ page }) => {
    await page.getByLabel('Semantic search query').fill('summarization and audio generation');
    await page.getByRole('button', { name: 'Search', exact: true }).click();

    const results = page.getByRole('list', { name: 'Search results' }).getByRole('listitem');
    await expect(results.first()).toContainText('docx_1.txt');
    await expect(results.first()).toContainText('% match');

    await results.first().getByRole('button', { name: 'View 1 summary' }).click();
    await expect(page.getByText('This is a test summary of the document content.').first()).toBeVisible();
  });

  test('should show an empty state when nothing matches', async ({ page }) => {
    await page.getByLabel('Semantic search query').fill('zzzqqq');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByText('No documents match')).toBeVisible();
  });
});

test.describe('Dashboard provider health', () => {
  test('should show the configured providers from /v1/models', async ({ page }) => {
    await expect(page.getByTestId('summary-engine-card')).toContainText('Ollama');
    await expect(page.getByTestId('summary-engine-card')).toContainText('llama3.2');
    await expect(page.getByTestId('audio-engine-card')).toContainText('macOS say');
    await expect(page.getByTestId('audio-engine-card')).toContainText('macos-say:Samantha');
  });
});
