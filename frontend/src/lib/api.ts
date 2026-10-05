import axios from "axios";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export type DocStatus = "uploaded" | "processing" | "text_ready" | "extraction_failed" | "summary_ready";

export interface UploadResponse {
  id: string;
  filename: string;
  status: DocStatus;
  message?: string;
  summary_text?: string;
  summary_word_count?: number;
}

export interface Summary {
  id: string;
  document_id: string;
  document_filename: string;
  summary_text: string;
  summary_word_count: number;
  summary_type: string;
  llm_model: string;
  processing_time_seconds: number;
  tokens_used: number;
  approval_status: string;
  created_at: string;
}

export async function uploadDocument(
  file: File,
  onProgress?: (pct: number) => void,
  formatType: string = "short_text"
) {
  const form = new FormData();
  form.append("file", file);
  form.append("format_type", formatType);

  console.log(`[FRONTEND] Uploading file with format_type: ${formatType}`);

  const res = await axios.post(`${API_BASE}/documents/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded * 100) / e.total)),
  });

  return res.data as UploadResponse;
}

export async function previewSummary(
  documentId: string,
  summaryType: string = "short_text"
) {
  const res = await axios.post(`${API_BASE}/documents/${documentId}/preview-summary`, {
    summary_type: summaryType,
  });

  return res.data;
}

export async function summarizeDocument(
  documentId: string,
  summaryType: string = "short_text",
  customText?: string
) {
  const res = await axios.post(`${API_BASE}/documents/${documentId}/summarize`, {
    summary_type: summaryType,
    custom_text: customText,
  });

  return res.data as Summary;
}

export async function getDocumentSummaries(documentId: string) {
  const res = await axios.get(`${API_BASE}/documents/${documentId}/summaries`);
  return res.data;
}

export async function getAllDocuments() {
  const res = await axios.get(`${API_BASE}/documents`);
  return res.data;
}

export async function getAllSummaries() {
  const res = await axios.get(`${API_BASE}/summary-list`);
  return res.data;
}

export async function getLatestSummary(documentId: string) {
  const res = await axios.get(`${API_BASE}/documents/${documentId}/summary`);
  return res.data as Summary;
}

export async function updateApproval(summaryId: string, status: "approved" | "rejected" | "final_approved", customName?: string) {
  const res = await axios.post(`${API_BASE}/summaries/${summaryId}/approval`, {
    status,
    custom_name: customName
  });
  return res.data;
}

export async function editSummary(summaryId: string, editedText: string) {
  const res = await axios.post(`${API_BASE}/summaries/${summaryId}/edit`, {
    edited_text: editedText,
  });
  return res.data;
}

export async function regenerateSummary(summaryId: string, formatType?: string) {
  const payload = formatType ? { format_type: formatType } : {};
  const res = await axios.post(`${API_BASE}/summaries/${summaryId}/regenerate`, payload);
  return res.data;
}

export async function deleteSummary(summaryId: string) {
  const res = await axios.delete(`${API_BASE}/summaries/${summaryId}`);
  return res.data;
}

export async function deleteDocument(documentId: string) {
  const res = await axios.delete(`${API_BASE}/documents/${documentId}`);
  return res.data;
}

export interface Audio {
  id: string;
  summary_id: string;
  document_filename: string;
  summary_type: string;
  audio_length_seconds: number;
  audio_format: string;
  tts_model: string;
  processing_time_seconds: number;
  characters_processed: number;
  created_at: string;
}

export async function getAllAudios() {
  const res = await axios.get(`${API_BASE}/audio-list`);
  return res.data;
}

export async function generateAudio(summaryId: string) {
  const res = await axios.post(`${API_BASE}/summaries/${summaryId}/generate-audio`);
  return res.data as Audio;
}

export async function downloadAudio(audioId: string) {
  const res = await axios.get(`${API_BASE}/audios/${audioId}/download`, {
    responseType: 'blob'
  });
  return res.data;
}

export async function deleteAudio(audioId: string) {
  const res = await axios.delete(`${API_BASE}/audios/${audioId}`);
  return res.data;
}

export async function getAudiosBySummaryId(summaryId: string) {
  const res = await axios.get(`${API_BASE}/audios?summary_id=${summaryId}`);
  return res.data;
}

export async function generateAudioFromDocument(documentId: string, formatType: string = "short_text") {
  const res = await axios.post(`${API_BASE}/documents/${documentId}/generate-audio`, {
    format_type: formatType
  });
  return res.data;
}
