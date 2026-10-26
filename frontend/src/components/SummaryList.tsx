import { useState, useEffect } from "react";
import type { Summary } from "../lib/api";
import { useDeleteSummary, useEditSummary, useUpsertSummary } from "../lib/queries";
import GenerateSummaryModal from "./GenerateSummaryModal";

// Simple modal for viewing full summary text
function SummaryPreviewModal({ summary, isOpen, onClose, onEdit }: { summary: Summary | null, isOpen: boolean, onClose: () => void, onEdit?: (summaryId: string, newText: string) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  const handleEdit = () => {
    if (!summary) return;
    setIsEditing(true);
    setEditedText(summary.summary_text);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedText("");
  };

  const handleSaveEdit = async () => {
    if (!summary || !editedText.trim() || !onEdit) return;

    try {
      await onEdit(summary.id, editedText.trim());
      // Update the summary with new word count
      summary.summary_text = editedText.trim();
      summary.summary_word_count = editedText.trim().split(/\s+/).length;
      setIsEditing(false);
      setEditedText("");
    } catch (error) {
      console.error("Failed to save edit:", error);
      alert("Failed to save edit. Please try again.");
    }
  };

  if (!isOpen || !summary) return null;

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
        maxWidth: "800px",
        width: "90%",
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
        border: "2px solid #646cff"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ color: "#fff", margin: 0 }}>Summary Preview</h2>
          <button
            onClick={onClose}
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

        <div style={{ marginBottom: "1rem" }}>
          <div style={{ color: "#888", fontSize: "0.9rem", marginBottom: "0.5rem" }}>
            Document: {summary.document_filename} • Type: {summary.summary_type} • Words: {isEditing ? editedText.split(/\s+/).length : summary.summary_word_count}
          </div>
        </div>

        <div style={{
          flex: 1,
          overflow: "auto",
          padding: "1.5rem",
          backgroundColor: "#2a2a2a",
          borderRadius: "8px",
          marginBottom: "1.5rem"
        }}>
          {isEditing ? (
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              style={{
                width: "100%",
                height: "300px",
                backgroundColor: "#1a1a1a",
                color: "#fff",
                border: "1px solid #646cff",
                borderRadius: "4px",
                padding: "1rem",
                fontSize: "0.95rem",
                fontFamily: "monospace",
                resize: "vertical"
              }}
              placeholder="Edit summary text..."
            />
          ) : (
            <div style={{
              color: "#fff",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              fontFamily: "monospace",
              fontSize: "0.95rem"
            }}>
              {summary.summary_text}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
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
                onClick={handleSaveEdit}
                disabled={!editedText.trim()}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  borderRadius: "6px",
                  backgroundColor: editedText.trim() ? "#22c55e" : "#444",
                  color: "#fff",
                  cursor: editedText.trim() ? "pointer" : "not-allowed"
                }}
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1px solid #333",
                  borderRadius: "6px",
                  backgroundColor: "#2a2a2a",
                  color: "#fff",
                  cursor: "pointer"
                }}
              >
                Edit Summary
              </button>
              <button
                onClick={onClose}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface SummaryListProps {
  summaries: Summary[];
  documentFilter?: string | null;
}

export default function SummaryList({ summaries, documentFilter }: SummaryListProps) {
  const deleteSummaryMutation = useDeleteSummary();
  const editSummaryMutation = useEditSummary();
  const upsertSummary = useUpsertSummary();
  const [filteredSummaries, setFilteredSummaries] = useState<Summary[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Summary>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);

  // Filter and sort summaries
  useEffect(() => {
    const filtered = summaries.filter(summary => {
      // Apply document filter first
      if (documentFilter && summary.document_id !== documentFilter) {
        return false;
      }

      // Apply search filter
      return summary.summary_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        summary.document_filename.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Sort summaries
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal == null || bVal == null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredSummaries(filtered);
  }, [searchTerm, sortField, sortDirection, summaries, documentFilter]);

  const handleSort = (field: keyof Summary) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getSortIcon = (field: keyof Summary) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const handleDownload = async (summary: Summary) => {
    try {
      // Create a downloadable file with the summary content
      const element = document.createElement('a');
      const file = new Blob(
        [`Document: ${summary.document_filename}\n\nSummary:\n${summary.summary_text}`],
        { type: 'text/plain' }
      );
      element.href = URL.createObjectURL(file);

      // Remove file extension from document filename to avoid double extensions
      const baseFilename = summary.document_filename.replace(/\.[^/.]+$/, '');
      element.download = `summary_${baseFilename}.txt`;

      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    } catch (error) {
      console.error('Failed to download summary:', error);
    }
  };

  const handleDeleteSummary = async (summaryId: string) => {
    if (window.confirm('Are you sure you want to delete this summary?')) {
      try {
        await deleteSummaryMutation.mutateAsync(summaryId);
      } catch (error) {
        console.error('Failed to delete summary:', error);
        alert('Failed to delete summary. Please try again.');
      }
    }
  };

  const handleOpenPreview = (summary: Summary) => {
    setSelectedSummary(summary);
    setPreviewModalOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewModalOpen(false);
    setSelectedSummary(null);
  };

  const handleEditSummary = async (summaryId: string, newText: string) => {
    try {
      await editSummaryMutation.mutateAsync({ summaryId, text: newText });
    } catch (error) {
      console.error('Failed to edit summary:', error);
      throw error;
    }
  };

  return (
    <div style={{ marginTop: '2rem' }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Search summaries..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid #333',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            fontSize: '1rem',
            width: '300px'
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ color: '#888' }}>
            {summaries.length} summar{summaries.length !== 1 ? 'ies' : 'y'} total
          </div>
          <button
            onClick={() => setGenerateModalOpen(true)}
            onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563'}
            onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#646cff'}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              backgroundColor: '#646cff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            Generate Summary
          </button>
        </div>
      </div>

      {filteredSummaries.length === 0 ? (
        <p style={{ color: '#888', padding: '2rem' }}>
          {searchTerm ? 'No summaries match your search.' : 'No summaries available.'}
        </p>
      ) : (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #333'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#2a2a2a' }}>
              <th
                onClick={() => handleSort('document_filename')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Document{getSortIcon('document_filename')}
              </th>
              <th
                onClick={() => handleSort('summary_type')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Type{getSortIcon('summary_type')}
              </th>
              <th
                onClick={() => handleSort('summary_word_count')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Words{getSortIcon('summary_word_count')}
              </th>
              <th
                onClick={() => handleSort('llm_model')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Model{getSortIcon('llm_model')}
              </th>
              <th
                onClick={() => handleSort('approval_status')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Status{getSortIcon('approval_status')}
              </th>
              <th
                onClick={() => handleSort('created_at')}
                style={{
                  padding: '1rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #646cff'
                }}
              >
                Created{getSortIcon('created_at')}
              </th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                color: '#fff',
                fontWeight: 'bold',
                borderBottom: '2px solid #646cff'
              }}>
                Preview
              </th>
              <th style={{
                padding: '1rem',
                textAlign: 'left',
                color: '#fff',
                fontWeight: 'bold',
                borderBottom: '2px solid #646cff'
              }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredSummaries.map((summary, index) => (
              <tr
                key={summary.id}
                style={{
                  borderBottom: index === filteredSummaries.length - 1 ? 'none' : '1px solid #333',
                  backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#222'
                }}
              >
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  {summary.document_filename}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {summary.summary_type}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {summary.summary_word_count}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {summary.llm_model}
                </td>
                <td style={{
                  padding: '1rem',
                  color: summary.approval_status === 'approved' || summary.approval_status === 'final_approved' ? '#4ade80' :
                    summary.approval_status === 'rejected' ? '#ef4444' : '#f59e0b',
                  fontSize: '0.95rem',
                  fontWeight: '500'
                }}>
                  {summary.approval_status === 'final_approved' ? 'approved' : summary.approval_status}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {formatDate(summary.created_at)}
                </td>
                <td style={{
                  padding: '1rem',
                  maxWidth: '300px',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  <div
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenPreview(summary)}
                    onMouseEnter={(e) => (e.target as HTMLDivElement).style.color = '#646cff'}
                    onMouseLeave={(e) => (e.target as HTMLDivElement).style.color = '#fff'}
                  >
                    {summary.summary_text.substring(0, 100)}...
                  </div>
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleDownload(summary)}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#0891b2'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#06b6d4'}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        backgroundColor: '#06b6d4',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={() => handleDeleteSummary(summary.id)}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#dc2626'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#ef4444'}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <GenerateSummaryModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onSummaryGenerated={(summary) => {
          upsertSummary(summary);
          setGenerateModalOpen(false);
        }}
      />

      <SummaryPreviewModal
        summary={selectedSummary}
        isOpen={previewModalOpen}
        onClose={handleClosePreview}
        onEdit={handleEditSummary}
      />
    </div>
  );
}
