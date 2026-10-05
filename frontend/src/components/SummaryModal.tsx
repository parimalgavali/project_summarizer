import { useState } from "react";
import { summarizeDocument } from "../lib/api";
import type { Summary } from "../lib/api";

type SummaryType = "short_text" | "bullet_points" | "academic_tone";

interface SummaryModalProps {
  document: {
    id: string;
    filename: string;
  };
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

export default function SummaryModal({
  document,
  isOpen,
  onClose,
  onSummaryGenerated
}: SummaryModalProps) {
  const [selectedType, setSelectedType] = useState<SummaryType>("short_text");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const summary = await summarizeDocument(document.id, selectedType);
      setGeneratedSummary(summary);
      onSummaryGenerated?.(summary);
    } catch (err) {
      console.error("Failed to generate summary:", err);
      setError("Failed to generate summary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setGeneratedSummary(null);
    setError(null);
    setSelectedType("short_text");
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
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        overflow: "auto",
        border: "2px solid #646cff"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "#fff", margin: 0 }}>Generate Summary</h2>
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

        <div style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ color: "#fff", marginBottom: "0.5rem" }}>Document: {document.filename}</h3>
        </div>

        {!generatedSummary ? (
          <>
            <div style={{ marginBottom: "2rem" }}>
              <h4 style={{ color: "#fff", marginBottom: "1rem" }}>Choose Summary Format</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {SUMMARY_TYPES.map((type) => (
                  <label
                    key={type.value}
                    style={{
                      display: "block",
                      padding: "1rem",
                      border: `2px solid ${selectedType === type.value ? "#646cff" : "#333"}`,
                      borderRadius: "8px",
                      backgroundColor: selectedType === type.value ? "#2a2a2a" : "#1a1a1a",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <input
                      type="radio"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value as SummaryType)}
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button
                onClick={handleClose}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  backgroundColor: "#2a2a2a",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
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
            </div>

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
          </>
        ) : (
          <div>
            <h4 style={{ color: "#fff", marginBottom: "1rem" }}>Summary Preview</h4>
            <div style={{
              padding: "1.5rem",
              backgroundColor: "#2a2a2a",
              borderRadius: "8px",
              marginBottom: "1.5rem"
            }}>
              <div style={{ color: "#888", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Type: {SUMMARY_TYPES.find(t => t.value === generatedSummary.summary_type)?.label}
                • Words: {generatedSummary.summary_word_count}
              </div>
              <div style={{
                color: "#fff",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap"
              }}>
                {generatedSummary.summary_text}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={handleClose}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: "#646cff",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
