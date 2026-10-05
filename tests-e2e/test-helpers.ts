import { APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://localhost:6702';
const RESET_DB_URL = `${API_BASE}/api/testing/reset-db`;
const UPLOAD_URL = `${API_BASE}/documents/upload`;
const SUMMARIZE_URL = (docId: string) => `${API_BASE}/documents/${docId}/summarize`;
const APPROVE_URL = (summaryId: string) => `${API_BASE}/summaries/${summaryId}/approval`;
const AUDIO_URL = (summaryId: string) => `${API_BASE}/summaries/${summaryId}/generate-audio`;
const DOC_AUDIO_URL = (docId: string) => `${API_BASE}/documents/${docId}/generate-audio`;

/**
 * Helper function to log detailed error information
 */
async function logErrorDetails(response: any, context: string) {
  console.error(`\n ${context} FAILED:`);
  console.error(`   Status: ${response.status()}`);
  console.error(`   Status Text: ${response.statusText()}`);
  
  try {
    const body = await response.text();
    console.error(`   Response Body: ${body}`);
  } catch (e) {
    console.error(`   Could not read response body`);
  }
  
  console.error(`   Headers:`, response.headers());
}

/**
 * Resets the entire database by calling the test API endpoint.
 */
export async function resetDatabase(request: APIRequestContext) {
  const response = await request.post(RESET_DB_URL);
  if (!response.ok()) {
    await logErrorDetails(response, 'Database Reset');
  }
  await expect(response.ok(), 'Database reset failed.').toBeTruthy();
}

/**
 * Uploads a document via the API to set up test state.
 * @returns {string} The ID of the newly uploaded document.
 */
export async function setupDocument(request: APIRequestContext, fixtureName: string): Promise<string> {
  const filePath = path.resolve('tests-e2e', 'fixtures', fixtureName);
  const fileBuffer = fs.readFileSync(filePath);

  const response = await request.post(UPLOAD_URL, {
    multipart: {
      file: {
        name: fixtureName,
        mimeType: 'application/octet-stream',
        buffer: fileBuffer,
      },
    },
  });

  if (!response.ok()) {
    await logErrorDetails(response, `Document Upload (${fixtureName})`);
  }

  await expect(response.ok(), `API call to upload document failed.`).toBeTruthy();
  const data = await response.json();
  
  if (data.status !== 'text_ready') {
    throw new Error(`Document upload succeeded but text extraction failed: ${data.message}`);
  }
  
  return data.id;
}

/**
 * Generates a summary for a document via the API.
 * @returns {string} The ID of the new summary.
 */
export async function setupSummary(
  request: APIRequestContext,
  documentId: string,
  format: string = 'short_text',
  customText?: string
): Promise<string> {
  const response = await request.post(SUMMARIZE_URL(documentId), {
    data: {
      summary_type: format,
      custom_text: customText
    },
    timeout: 30000
  });

  if (!response.ok()) {
    await logErrorDetails(response, `Summary Generation for doc ${documentId}`);
  }

  await expect(response.status()).toBeLessThan(300);
  await expect(response.ok(), `Failed to generate summary for doc ${documentId}`).toBeTruthy();
  const data = await response.json();
  return data.id;
}

/**
 * Approves a summary via the API.
 */
export async function setupApproval(request: APIRequestContext, summaryId: string, status: string = 'approved') {
  const response = await request.post(APPROVE_URL(summaryId), {
    data: { status: status }
  });

  if (!response.ok()) {
    await logErrorDetails(response, `Approval for summary ${summaryId}`);
  }

  await expect(response.ok(), `Failed to approve summary ${summaryId}`).toBeTruthy();
}

/**
 * Generates audio for a summary via the API.
 * @returns {string} The ID of the new audio.
 */
export async function setupAudio(request: APIRequestContext, summaryId: string): Promise<string> {
  const response = await request.post(AUDIO_URL(summaryId), {
    timeout: 30000
  });

  if (!response.ok()) {
    await logErrorDetails(response, `Audio Generation for summary ${summaryId}`);
  }

  await expect(response.ok(), `Failed to generate audio for summary ${summaryId}`).toBeTruthy();
  const data = await response.json();
  return data.id;
}

/**
 * Generates audio directly from a document, skipping the separate summary step.
 * @returns {string} The ID of the new audio.
 */
export async function setupAudioDirectlyFromDoc(request: APIRequestContext, docId: string) {
  const response = await request.post(DOC_AUDIO_URL(docId), {
    data: { format_type: 'bullet_points' }
  });

  if (!response.ok()) {
    await logErrorDetails(response, `Direct Audio Generation for doc ${docId}`);
  }

  await expect(response.ok(), `Failed to generate audio for doc ${docId}`).toBeTruthy();
  const data = await response.json();
  return data.audio_id;
}