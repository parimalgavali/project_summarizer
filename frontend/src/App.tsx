import { useEffect, useMemo, useState } from "react";
import "./App.css";
import UploadPanel from "./components/UploadPanel";
import DocumentList from "./components/DocumentList";
import SummaryList from "./components/SummaryList";
import AudioList from "./components/AudioList";
import DocumentSummariesModal from "./components/DocumentSummariesModal";
import { getAllDocuments, getAllSummaries } from "./lib/api";
import type { Summary } from "./lib/api";

interface BackendDocument {
  id: string;
  filename: string;
  file_size: number;
  extraction_status: string;
  word_count: number | null;
  created_at: string | null;
}

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
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [documentFilter, setDocumentFilter] = useState<string | null>(null);
  const [modalDocument, setModalDocument] = useState<{
    id: string;
    filename: string;
  } | null>(null);

  const refreshData = async () => {
    try {
      const [docsResponse, summariesResponse] = await Promise.all([
        getAllDocuments(),
        getAllSummaries(),
      ]);
      setDocuments(docsResponse.data || []);
      setSummaries(summariesResponse.data || []);
    } catch (error) {
      console.error("Failed to refresh workspace data:", error);
    }
  };

  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    refreshData();
  }, []);

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
            <strong>{documents.length}</strong>
            <small>{readyDocuments} ready for AI</small>
          </div>
          <div className="metric-card">
            <span>Summaries</span>
            <strong>{summaries.length}</strong>
            <small>{approvedSummaries} approved outputs</small>
          </div>
          <div className="metric-card">
            <span>Summary engine</span>
            <strong>Ollama</strong>
            <small>Llama 3.2 local provider</small>
          </div>
          <div className="metric-card">
            <span>Audio engine</span>
            <strong>macOS</strong>
            <small>Built-in say command</small>
          </div>
        </section>

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
              <UploadPanel onUpload={refreshData} />
              <DocumentList
                documents={documents}
                onDocumentAction={refreshData}
                onNavigateToSummaries={openDocumentSummariesModal}
              />
            </>
          )}

          {activeTab === "summaries" && (
            <SummaryList
              summaries={summaries}
              onSummaryAction={refreshData}
              documentFilter={documentFilter}
            />
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
