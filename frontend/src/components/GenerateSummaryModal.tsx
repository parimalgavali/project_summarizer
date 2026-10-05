import { useState, useEffect } from "react";
import { previewSummary, summarizeDocument, getAllDocuments, updateApproval } from "../lib/api";
import type { Summary } from "../lib/api";
import CustomNameModal from "./CustomNameModal";

interface BackendDocument {
  id: string;
  filename: string;
  extraction_status: string;
}

type SummaryType = "short_text" | "bullet_points" | "academic_tone";

interface GenerateSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSummaryGenerated?: (summary: Summary) => void;
}

const SUMMARY_TYPES: { value: SummaryType; label: string; description: string }[] = [
  {
    value: "short_text",
    label: "Short Text",
    description: "A concise paragraph summary of the document content"
  },
  {
    value: "bullet_points",
    label: "Bullet Points",
    description: "Key points and main ideas in bullet point format"
  },
  {
    value: "academic_tone",
    label: "Academic Tone",
    description: "Formal academic writing style with citations if relevant"
  }
];

export default function GenerateSummaryModal({
  isOpen,
  onClose,
  onSummaryGenerated
}: GenerateSummaryModalProps) {
  const [step, setStep] = useState<"select_doc" | "select_format" | "generating" | "preview" | "comparison">("select_doc");
  const [documents, setDocuments] = useState<BackendDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<BackendDocument | null>(null);
  const [selectedType, setSelectedType] = useState<SummaryType>("short_text");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<SummaryType[]>([]);
  const [comparisonSummaries, setComparisonSummaries] = useState<Summary[]>([]);
  const [customNameModalOpen, setCustomNameModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && step === "select_doc") {
      loadDocuments();
    }
  }, [isOpen, step]);

  const loadDocuments = async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs.data || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError("Failed to load documents");
    }
  };

  const handleDocumentSelect = (doc: BackendDocument) => {
    if (doc.extraction_status === 'extracted') {
      setSelectedDocument(doc);
      setStep("select_format");
      setError(null);
    } else {
      setError("Document must be fully processed before generating summaries");
    }
  };

  const createSummaryFromPreview = (previewData: Partial<Summary>): Summary => {
    // Create a temporary Summary object from preview data
    return {
      id: `temp-${Date.now()}`, // Temporary ID until saved
      document_id: previewData.document_id || '',
      document_filename: previewData.document_filename || '',
      summary_text: previewData.summary_text || '',
      summary_word_count: previewData.summary_word_count || 0,
      summary_type: previewData.summary_type || 'short_text',
      llm_model: previewData.llm_model || '',
      processing_time_seconds: previewData.processing_time_seconds || 0,
      tokens_used: previewData.tokens_used || 0,
      approval_status: "pending",
      created_at: new Date().toISOString()
    };
  };

  const handleGeneratePreview = async () => {
    if (!selectedDocument) return;

    setIsGenerating(true);
    setError(null);
    setStep("generating");

    try {
      const previewData = await previewSummary(selectedDocument.id, selectedType);
      const summary = createSummaryFromPreview(previewData);
      setGeneratedSummary(summary);
      setStep("preview");
      // Don't call onSummaryGenerated yet - wait for user action
    } catch (err) {
      console.error("Failed to generate summary:", err);
      setError("Failed to generate summary. Please try again.");
      setStep("select_format");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprovePreview = () => {
    // Open custom name modal instead of directly saving
    setCustomNameModalOpen(true);
  };

  const handleSaveApproval = async (customName: string) => {
    if (!generatedSummary || !selectedDocument) return;

    try {
      // Save the summary to the database with the current text (which may have been edited)
      const savedSummary = await summarizeDocument(selectedDocument.id, selectedType, generatedSummary.summary_text);

      // Update with custom name and approve it
      const customNamedSummary = await updateApproval(savedSummary.id, "approved", customName);

      // Call the callback to refresh the list
      onSummaryGenerated?.(customNamedSummary);

      // Close modals
      setCustomNameModalOpen(false);
      handleClose();
    } catch (err) {
      console.error("Failed to approve summary:", err);
    }
  };

  const handleCancelApproval = () => {
    setCustomNameModalOpen(false);
  };

  const handleRejectPreview = () => {
    // Just close the popup without saving anything
    handleClose();
  };

  const handleEditPreview = () => {
    if (!generatedSummary) return;
    setIsEditing(true);
    setEditedText(generatedSummary.summary_text);
  };

  const handleCancelEditPreview = () => {
    setIsEditing(false);
    setEditedText("");
  };

  const handleSaveEditedPreview = () => {
    if (!generatedSummary || !editedText.trim()) return;

    // Update the generated summary with edited text
    setGeneratedSummary({
      ...generatedSummary,
      summary_text: editedText.trim(),
      summary_word_count: editedText.trim().split(/\s+/).length
    });

    // Return to preview mode
    setIsEditing(false);
    setEditedText("");
  };

  const handleGenerateComparison = () => {
    if (selectedFormats.length >= 2) {
      handleGenerateComparisonPreview();
    } else {
      setError("Please select at least 2 formats to compare");
    }
  };

  const handleGenerateComparisonPreview = async () => {
    if (!selectedDocument || selectedFormats.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setStep("generating");

    try {
      const summaries = [];
      for (const format of selectedFormats) {
        const previewData = await previewSummary(selectedDocument.id, format);
        const summary = createSummaryFromPreview(previewData);
        summaries.push(summary);
      }
      setComparisonSummaries(summaries);
      setStep("comparison");
    } catch (err) {
      console.error("Failed to generate comparison summaries:", err);
      setError("Failed to generate summary comparison. Please try again.");
      setStep("select_format");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectComparisonSummary = (summary: Summary) => {
    setGeneratedSummary(summary);
    setSelectedType(summary.summary_type as SummaryType);
    setIsComparisonMode(false);
    setComparisonSummaries([]);
    setStep("preview");
  };

  const handleClose = () => {
    setStep("select_doc");
    setSelectedDocument(null);
    setSelectedType("short_text" as SummaryType);
    setGeneratedSummary(null);
    setError(null);
    setIsEditing(false);
    setEditedText("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "#1a1a1a",
        borderRadius: "12px",
        padding: "2rem",
        maxWidth: step === "comparison" ? "1400px" : "600px",
        width: "95%",
        maxHeight: step === "comparison" ? "90vh" : "80vh",
        display: "flex",
        flexDirection: "column",
        borderColor: "#646cff",
        borderStyle: "solid",
        borderWidth: "2px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "#fff", margin: 0 }}>
            {step === "select_doc" && "Select Document"}
            {step === "select_format" && "Choose Summary Format"}
            {step === "generating" && "Generating Summary..."}
            {step === "preview" && "Summary Preview"}
            {step === "comparison" && "Compare Summaries"}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "0.5rem",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            ×
          </button>
        </div>

        {/* Step 1: Document Selection */}
        {step === "select_doc" && (
          <div>
            <h4 style={{ color: "#fff", marginBottom: "1rem" }}>Choose a document to summarize</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "400px", overflow: "auto" }}>
              {documents.length === 0 ? (
                <p style={{ color: "#888", padding: "1rem" }}>No documents available</p>
              ) : (
                documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => handleDocumentSelect(doc)}
                    disabled={doc.extraction_status !== 'extracted'}
                    style={{
                      padding: "1rem",
                      textAlign: "left",
                      backgroundColor: doc.extraction_status === 'extracted' ? "#2a2a2a" : "#1a1a1a",
                      border: "1px solid #333",
                      borderRadius: "4px",
                      cursor: doc.extraction_status === 'extracted' ? "pointer" : "not-allowed",
                      opacity: doc.extraction_status === 'extracted' ? 1 : 0.6
                    }}
                  >
                    <div style={{ color: "#fff", fontSize: "0.9rem", fontWeight: "500" }}>
                      {doc.filename}
                    </div>
                    <div style={{
                      color: doc.extraction_status === 'extracted' ? '#4ade80' : '#f59e0b',
                      fontSize: "0.8rem",
                      marginTop: "0.25rem"
                    }}>
                      {doc.extraction_status}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: Format Selection */}
        {step === "select_format" && (
          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <h4 style={{ color: "#fff", marginBottom: "0.5rem" }}>Selected Document</h4>
              <div style={{ color: "#888" }}>{selectedDocument?.filename}</div>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h4 style={{ color: "#fff", margin: 0 }}>Choose Summary Format</h4>
                <label style={{ color: "#888", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    checked={isComparisonMode}
                    onChange={(e) => {
                      setIsComparisonMode(e.target.checked);
                      if (!e.target.checked) {
                        setSelectedFormats([]);
                      }
                    }}
                    style={{ marginRight: "0.5rem" }}
                  />
                  Compare Multiple Formats
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {SUMMARY_TYPES.map((type) => (
                  <label
                    key={type.value}
                    style={{
                      display: "block",
                      padding: "1rem",
                      borderStyle: "solid",
                      borderWidth: "2px",
                      borderColor: isComparisonMode
                        ? (selectedFormats.includes(type.value) ? "#646cff" : "#333")
                        : (selectedType === type.value ? "#646cff" : "#333"),
                      borderRadius: "8px",
                      backgroundColor: isComparisonMode
                        ? (selectedFormats.includes(type.value) ? "#2a2a2a" : "#1a1a1a")
                        : (selectedType === type.value ? "#2a2a2a" : "#1a1a1a"),
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <input
                      type={isComparisonMode ? "checkbox" : "radio"}
                      value={type.value}
                      checked={isComparisonMode
                        ? selectedFormats.includes(type.value)
                        : selectedType === type.value}
                      onChange={(e) => {
                        if (isComparisonMode) {
                          setSelectedFormats(prev =>
                            e.target.checked
                              ? [...prev, e.target.value as SummaryType]
                              : prev.filter(f => f !== e.target.value)
                          );
                        } else {
                          setSelectedType(e.target.value as SummaryType);
                        }
                      }}
                      style={{ marginRight: "0.5rem" }}
                    />
                    <strong style={{ color: "#fff" }}>{type.label}</strong>
                    <p style={{ color: "#888", marginTop: "0.25rem", marginBottom: 0, fontSize: "0.9rem" }}>
                      {type.description}
                    </p>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => {
                  if (isRegenerating) {
                    setIsRegenerating(false);
                    setStep("preview");
                  } else {
                    setStep("select_doc");
                  }
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  backgroundColor: "#2a2a2a",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Back
              </button>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {isComparisonMode ? (
                  <button
                    onClick={handleGenerateComparison}
                    disabled={isGenerating || selectedFormats.length < 2}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: (isGenerating || selectedFormats.length < 2) ? "#444" : "#f59e0b",
                      color: "#fff",
                      cursor: (isGenerating || selectedFormats.length < 2) ? "not-allowed" : "pointer"
                    }}
                  >
                    {isGenerating ? "Generating..." : `Compare ${selectedFormats.length} Formats`}
                  </button>
                ) : (
                  <button
                    onClick={handleGeneratePreview}
                    disabled={isGenerating}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: isGenerating ? "#444" : "#646cff",
                      color: "#fff",
                      cursor: isGenerating ? "not-allowed" : "pointer"
                    }}
                  >
                    {isGenerating ? "Generating..." : "Generate Summary"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Generating */}
        {step === "generating" && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ color: "#fff", marginBottom: "1rem", fontSize: "1.2rem" }}>
              Generating summary...
            </div>
            <div style={{ color: "#888" }}>
              This may take a few seconds
            </div>
          </div>
        )}

        {/* Step 4: Preview with Actions */}
        {step === "preview" && generatedSummary && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0
          }}>
            <h4 style={{ color: "#fff", marginBottom: "1rem" }}>
              {isEditing ? "Edit Summary" : "Summary Preview"}
            </h4>
            <div style={{
              padding: "1.5rem",
              backgroundColor: "#2a2a2a",
              borderRadius: "8px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              marginBottom: "1.5rem"
            }}>
              <div style={{ color: "#888", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Document: {selectedDocument?.filename} • Format: {SUMMARY_TYPES.find(t => t.value === generatedSummary.summary_type)?.label} • Words: {isEditing ? editedText.split(/\s+/).length : generatedSummary.summary_word_count}
              </div>
              <div style={{
                flex: 1,
                overflow: "auto",
                minHeight: 0
              }}>
                {isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    style={{
                      width: "100%",
                      minHeight: "120px",
                      backgroundColor: "#1a1a1a",
                      color: "#fff",
                      border: "1px solid #646cff",
                      borderRadius: "4px",
                      padding: "0.5rem",
                      fontSize: "0.9rem",
                      resize: "vertical"
                    }}
                    placeholder="Edit summary text..."
                  />
                ) : (
                  <div style={{
                    color: "#fff",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap"
                  }}>
                    {generatedSummary.summary_text}
                  </div>
                )}
              </div>
            </div>
            <div style={{
              flexShrink: 0,
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap"
            }}>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveEditedPreview}
                    disabled={!editedText.trim()}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: editedText.trim() ? "#22c55e" : "#444",
                      color: "#fff",
                      cursor: editedText.trim() ? "pointer" : "not-allowed",
                      fontSize: "0.9rem"
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEditPreview}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: "#dc2626",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleApprovePreview}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: "#22c55e",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={handleRejectPreview}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: "#dc2626",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Reject
                  </button>
                  <button
                    onClick={handleEditPreview}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: "#646cff",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setIsRegenerating(true);
                      setStep("select_format");
                      setError(null);
                      setIsEditing(false);
                      setEditedText("");
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      border: "none",
                      borderRadius: "6px",
                      backgroundColor: "#f59e0b",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.9rem"
                    }}
                  >
                    Regenerate
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Comparison View */}
        {step === "comparison" && comparisonSummaries.length > 0 && (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0
          }}>
            <h4 style={{ color: "#fff", marginBottom: "1rem" }}>
              Choose your preferred summary format
            </h4>
            <div style={{ color: "#888", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Document: {selectedDocument?.filename}
            </div>
            <div style={{
              flex: 1,
              display: "flex",
              flexDirection: "row",
              gap: "1rem",
              overflow: "auto",
              minHeight: 0
            }}>
              {comparisonSummaries.map((summary) => (
                <div
                  key={summary.id}
                  style={{
                    flex: 1,
                    padding: "1.5rem",
                    backgroundColor: "#2a2a2a",
                    borderRadius: "8px",
                    border: "1px solid #333",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "400px"
                  }}
                >
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem"
                  }}>
                    <div style={{
                      color: "#646cff",
                      fontSize: "0.9rem",
                      fontWeight: "bold"
                    }}>
                      {SUMMARY_TYPES.find(t => t.value === summary.summary_type)?.label}
                    </div>
                    <button
                      onClick={() => handleSelectComparisonSummary(summary)}
                      style={{
                        padding: "0.5rem 1rem",
                        border: "none",
                        borderRadius: "6px",
                        backgroundColor: "#22c55e",
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "0.8rem"
                      }}
                    >
                      Select This Summary
                    </button>
                  </div>
                  <div style={{
                    color: "#888",
                    fontSize: "0.8rem",
                    marginBottom: "0.5rem"
                  }}>
                    Words: {summary.summary_word_count}
                  </div>
                  <div style={{
                    flex: 1,
                    color: "#fff",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    overflow: "auto",
                    padding: "0.5rem",
                    backgroundColor: "#1a1a1a",
                    borderRadius: "4px",
                    marginTop: "0.5rem"
                  }}>
                    {summary.summary_text}
                  </div>
                </div>
              ))}
            </div>
            <div style={{
              flexShrink: 0,
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1rem"
            }}>
              <button
                onClick={() => {
                  setComparisonSummaries([]);
                  setIsComparisonMode(false);
                  setSelectedFormats([]);
                  setStep("select_format");
                }}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  backgroundColor: "#2a2a2a",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: "1rem",
            padding: "1rem",
            borderRadius: "8px",
            backgroundColor: "#dc2626",
            color: "#fff"
          }}>
            {error}
          </div>
        )}
      </div>

      <CustomNameModal
        isOpen={customNameModalOpen}
        onClose={handleCancelApproval}
        onSave={handleSaveApproval}
        actionLabel="Approve Summary"
        defaultValue=""
      />
    </div>
  );
}
