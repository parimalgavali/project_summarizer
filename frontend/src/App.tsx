import { useEffect, useMemo, useState } from "react";
import "./App.css";
import UploadPanel from "./components/UploadPanel";
import DocumentList from "./components/DocumentList";
import SummaryList from "./components/SummaryList";
import AudioList from "./components/AudioList";
import DocumentSummariesModal from "./components/DocumentSummariesModal";
import QueryStatus from "./components/QueryStatus";
import SearchPanel from "./components/SearchPanel";
import {
  EMPTY_LIST,
  useDocuments,
  useInvalidateDocuments,
  useModels,
  useSummaries,
} from "./lib/queries";
import type { ModelsResponse } from "./lib/api";

const AI_PROVIDER_LABELS: Record<ModelsResponse["data"][number]["provider"], string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  huggingface: "Hugging Face",
};

const TTS_PROVIDER_LABELS: Record<ModelsResponse["tts"]["provider"], string> = {
  macos_say: "macOS say",
  openai: "OpenAI TTS",
};

type ActiveTab = "documents" | "summaries" | "audio";

const tabs: { id: ActiveTab; label: string; short: string }[] = [
  { id: "documents", label: "Documents", short: "D" },
  { id: "summaries", label: "Summaries", short: "S" },
  { id: "audio", label: "Audio Studio", short: "A" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const stored = localStorage.getItem("activeTab");
    return stored === "summaries" || stored === "audio" ? stored : "documents";
  });
  const documentsQuery = useDocuments();
  const summariesQuery = useSummaries();
  const invalidateDocuments = useInvalidateDocuments();
  const modelsQuery = useModels();
  const summaryModel = modelsQuery.data?.data[0];
  const ttsModel = modelsQuery.data?.tts;
  const providerFallback = modelsQuery.isError ? "Unavailable" : "—";
  const providerDetailFallback = modelsQuery.isError
    ? "Could not reach /v1/models"
    : "Checking provider...";
  const documents = documentsQuery.data ?? EMPTY_LIST;
  const summaries = summariesQuery.data ?? EMPTY_LIST;
  const [documentFilter, setDocumentFilter] = useState<string | null>(null);
  const [modalDocument, setModalDocument] = useState<{
    id: string;
    filename: string;
  } | null>(null);

  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  const approvedSummaries = useMemo(
    () =>
      summaries.filter(
        (summary) =>
          summary.approval_status === "approved" ||
          summary.approval_status === "final_approved"
      ).length,
    [summaries]
  );

  const readyDocuments = useMemo(
    () =>
      documents.filter(
        (document) =>
          document.extraction_status === "extracted" ||
          document.extraction_status === "text_ready"
      ).length,
    [documents]
  );

  const openDocumentSummariesModal = (
    documentId: string,
    documentFilename: string
  ) => {
    setModalDocument({
      id: documentId,
      filename: documentFilename,
    });
  };

  const changeTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setDocumentFilter(null);
    localStorage.removeItem("documentFilter");
  };

  return (
    <div className="workbench-shell">
      <aside className="app-rail" aria-label="Primary">
        <div className="brand-lockup">
          <div className="brand-mark">D</div>
          <div>
            <strong>DocuMind</strong>
            <span>Local AI</span>
          </div>
        </div>

        <nav className="rail-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`rail-nav-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => changeTab(tab.id)}
              title={tab.label}
            >
              <span>{tab.short}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="provider-card">
          <span className="eyebrow">Local stack</span>
          <strong>Ollama + macOS say</strong>
          <p>Llama 3.2 summaries, EmbeddingGemma search, local audio export.</p>
        </div>
      </aside>

      <main className="workbench-main">
        <section className="hero-panel">
          <div>
            <span className="eyebrow">AI document intelligence</span>
            <h1>Turn long documents into trusted, reviewable AI outputs.</h1>
            <p>
              Upload PDFs, DOCX, or text files, generate local summaries, review
              evidence-backed outputs, and export audio without requiring an
              external API key.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => changeTab("documents")}>
                Upload document
              </button>
              <button className="secondary-action" onClick={() => changeTab("summaries")}>
                Review summaries
              </button>
            </div>
          </div>

          <div className="drop-preview">
            <div className="drop-icon">UP</div>
            <strong>Local-first workspace</strong>
            <span>
              AI tasks are designed to run through Ollama and lightweight local
              services on your laptop.
            </span>
          </div>
        </section>

        <section className="metric-grid" aria-label="Workspace metrics">
          <div className="metric-card">
            <span>Documents</span>
            <strong>{documentsQuery.isPending ? "—" : documents.length}</strong>
            <small>{readyDocuments} ready for AI</small>
          </div>
          <div className="metric-card">
            <span>Summaries</span>
            <strong>{summariesQuery.isPending ? "—" : summaries.length}</strong>
            <small>{approvedSummaries} approved outputs</small>
          </div>
          <div className="metric-card" data-testid="summary-engine-card">
            <span>Summary engine</span>
            <strong>
              {summaryModel ? AI_PROVIDER_LABELS[summaryModel.provider] : providerFallback}
            </strong>
            <small>{summaryModel ? summaryModel.id : providerDetailFallback}</small>
          </div>
          <div className="metric-card" data-testid="audio-engine-card">
            <span>Audio engine</span>
            <strong>{ttsModel ? TTS_PROVIDER_LABELS[ttsModel.provider] : providerFallback}</strong>
            <small>{ttsModel ? ttsModel.model : providerDetailFallback}</small>
          </div>
        </section>

        <SearchPanel onOpenDocument={openDocumentSummariesModal} />

        <section className="workspace-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">
                {activeTab === "documents" && "Upload and inspect"}
                {activeTab === "summaries" && "Review and approve"}
                {activeTab === "audio" && "Listen and export"}
              </span>
              <h2>{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
            </div>
          </div>

          {activeTab === "documents" && (
            <>
              <UploadPanel onUpload={invalidateDocuments} />
              <QueryStatus
                label="documents"
                isPending={documentsQuery.isPending}
                error={documentsQuery.error}
                onRetry={() => documentsQuery.refetch()}
              />
              {documentsQuery.data && (
                <DocumentList
                  documents={documents}
                  onNavigateToSummaries={openDocumentSummariesModal}
                />
              )}
            </>
          )}

          {activeTab === "summaries" && (
            <>
              <QueryStatus
                label="summaries"
                isPending={summariesQuery.isPending}
                error={summariesQuery.error}
                onRetry={() => summariesQuery.refetch()}
              />
              {summariesQuery.data && (
                <SummaryList summaries={summaries} documentFilter={documentFilter} />
              )}
            </>
          )}

          {activeTab === "audio" && <AudioList />}
        </section>
      </main>

      {modalDocument && (
        <DocumentSummariesModal
          isOpen={!!modalDocument}
          onClose={() => setModalDocument(null)}
          documentId={modalDocument.id}
          documentFilename={modalDocument.filename}
        />
      )}
    </div>
  );
}
