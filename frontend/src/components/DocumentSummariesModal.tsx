import { useState, useEffect, useCallback } from "react";
import {
  getDocumentSummaries,
  getAudiosBySummaryId,
  type Summary,
  type Audio
} from "../lib/api";
import {
  useDeleteSummary,
  useEditSummary,
  useRegenerateSummary,
  useUpdateApproval,
} from "../lib/queries";

interface DocumentSummariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentFilename: string;
}

interface SummaryWithAudio extends Summary {
  audio?: Audio[];
}

export default function DocumentSummariesModal({
  isOpen,
  onClose,
  documentId,
  documentFilename
}: DocumentSummariesModalProps) {
  const [summaries, setSummaries] = useState<SummaryWithAudio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>("");
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const deleteSummaryMutation = useDeleteSummary();
  const editSummaryMutation = useEditSummary();
  const regenerateSummaryMutation = useRegenerateSummary();
  const updateApprovalMutation = useUpdateApproval();

  const mergeSummary = (updated: Partial<Summary> & { id: string }) =>
    setSummaries((items) =>
      items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );

  const fetchDocumentSummaries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDocumentSummaries(documentId);
      const summariesData: Summary[] = response.data || [];

      // For each summary, check if it has audio
      const summariesWithAudio: SummaryWithAudio[] = await Promise.all(
        summariesData.map(async (summary) => {
          // Get audio data for this summary
          let audioData: Audio[] = [];
          try {
            const audioResponse = await getAudiosBySummaryId(summary.id);
            audioData = audioResponse.data || [];
          } catch {
            console.log(`No audio found for summary ${summary.id}`);
          }
          return { ...summary, audio: audioData };
        })
      );

      setSummaries(summariesWithAudio);
    } catch (err) {
      console.error('Failed to fetch document summaries:', err);
      setError('Failed to load summaries');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchDocumentSummaries();
    }
  }, [isOpen, documentId, fetchDocumentSummaries]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleDeleteSummary = async (summaryId: string) => {
    if (window.confirm('Are you sure you want to delete this summary?')) {
      try {
        await deleteSummaryMutation.mutateAsync(summaryId);
        setSummaries((items) => items.filter((item) => item.id !== summaryId));
        setExpandedAction(null); // Close actions panel
      } catch (error) {
        console.error('Failed to delete summary:', error);
        alert('Failed to delete summary. Please try again.');
      }
    }
  };

  const handleDownloadSummary = async (summary: Summary) => {
    try {
      // Create a downloadable file with the summary content
      const element = document.createElement('a');
      const file = new Blob(
        [`Document: ${documentFilename}\n\nSummary Type: ${summary.summary_type}\n\nSummary:\n${summary.summary_text}`],
        { type: 'text/plain' }
      );
      element.href = URL.createObjectURL(file);

      // Remove file extension from document filename to avoid double extensions
      const baseFilename = documentFilename.replace(/\.[^/.]+$/, '');
      const summaryTypeSlug = summary.summary_type.toLowerCase().replace(/\s+/g, '-');
      element.download = `summary_${summaryTypeSlug}_${baseFilename}.txt`;

      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      setExpandedAction(null); // Close actions panel
    } catch (error) {
      console.error('Failed to download summary:', error);
      alert('Failed to download summary.');
    }
  };

  const startEdit = (summary: Summary) => {
    setEditingId(summary.id);
    setEditText(summary.summary_text);
    setExpandedAction(null); // Close actions panel
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const saveEdit = async (summary: Summary) => {
    if (!editText.trim()) return;

    try {
      const updated = await editSummaryMutation.mutateAsync({
        summaryId: summary.id,
        text: editText.trim(),
      });
      mergeSummary(updated);
      setEditingId(null);
      setEditText("");
    } catch (error) {
      console.error('Failed to save edited summary:', error);
      alert('Failed to save changes.');
    }
  };

  const handleRegenerate = async (summaryId: string) => {
    setRegeneratingId(summaryId);
    setExpandedAction(null); // Close actions panel
    try {
      mergeSummary(await regenerateSummaryMutation.mutateAsync(summaryId));
    } catch (error) {
      console.error('Failed to regenerate summary:', error);
      alert('Failed to regenerate summary.');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleApprove = async (summaryId: string, status: "approved" | "final_approved" | "rejected") => {
    try {
      mergeSummary(await updateApprovalMutation.mutateAsync({ summaryId, status }));
      setExpandedAction(null); // Close actions panel
    } catch (error) {
      console.error('Failed to update approval status:', error);
      alert('Failed to update approval status.');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1500
    }} onClick={onClose}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        maxWidth: '1200px',
        maxHeight: '80vh',
        width: '90vw',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              margin: 0,
              color: '#fff',
              fontSize: '1.5rem'
            }}>
              Summaries for: {documentFilename}
            </h2>
            <p style={{
              margin: '0.5rem 0 0 0',
              color: '#888',
              fontSize: '0.9rem'
            }}>
              {summaries.length} summar{summaries.length !== 1 ? 'ies' : 'y'} found
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              backgroundColor: '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem',
              cursor: 'pointer',
              fontSize: '1.2rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          maxHeight: 'calc(80vh - 120px)',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '3rem',
              color: '#888'
            }}>
              Loading summaries...
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#ef4444'
            }}>
              {error}
            </div>
          ) : summaries.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: '#888'
            }}>
              No summaries found for this document.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {summaries.map((summary) => (
                <div key={summary.id} style={{
                  backgroundColor: '#222',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  border: '1px solid #333'
                }}>
                  {/* Summary Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <h3 style={{
                        margin: 0,
                        color: '#fff',
                        fontSize: '1.1rem',
                        fontWeight: 'bold'
                      }}>
                        {summary.summary_type} Summary
                      </h3>
                      <div style={{
                        display: 'flex',
                        gap: '1rem',
                        marginTop: '0.5rem',
                        fontSize: '0.8rem',
                        color: '#888'
                      }}>
                        <span>Model: {summary.llm_model}</span>
                        <span>Words: {summary.summary_word_count}</span>
                        <span>Status: <span style={{
                          color: summary.approval_status === 'approved' || summary.approval_status === 'final_approved' ? '#4ade80' :
                            summary.approval_status === 'rejected' ? '#ef4444' : '#f59e0b'
                        }}>
                          {summary.approval_status === 'final_approved' ? 'approved' : summary.approval_status}
                        </span></span>
                      </div>
                      <div style={{
                        fontSize: '0.8rem',
                        color: '#666',
                        marginTop: '0.25rem'
                      }}>
                        Created: {formatDate(summary.created_at)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => setExpandedAction(expandedAction === summary.id ? null : summary.id)}
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.7rem',
                          backgroundColor: '#646cff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {expandedAction === summary.id ? 'Hide Actions' : 'Actions'}
                      </button>

                      {expandedAction === summary.id && (
                        <div style={{
                          display: 'flex',
                          gap: '0.3rem',
                          marginTop: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {/* Approval buttons for pending summaries */}
                          {summary.approval_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(summary.id, 'approved')}
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.6rem',
                                  backgroundColor: '#4ade80',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                                title="Approve summary"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleApprove(summary.id, 'rejected')}
                                style={{
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.6rem',
                                  backgroundColor: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '3px',
                                  cursor: 'pointer'
                                }}
                                title="Reject summary"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {/* Final approve for approved summaries */}
                          {summary.approval_status === 'approved' && (
                            <button
                              onClick={() => handleApprove(summary.id, 'final_approved')}
                              style={{
                                padding: '0.2rem 0.4rem',
                                fontSize: '0.6rem',
                                backgroundColor: '#059669',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                              title="Final approve summary"
                            >
                              Final Approve
                            </button>
                          )}
                          {/* Other action buttons */}
                          <button
                            onClick={() => startEdit(summary)}
                            style={{
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.6rem',
                              backgroundColor: '#4338ca',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                            title="Edit summary text"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleRegenerate(summary.id)}
                            disabled={regeneratingId === summary.id}
                            style={{
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.6rem',
                              backgroundColor: regeneratingId === summary.id ? '#374151' : '#f59e0b',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: regeneratingId === summary.id ? 'not-allowed' : 'pointer'
                            }}
                            title="Regenerate summary"
                          >
                            {regeneratingId === summary.id ? '...' : 'Regenerate'}
                          </button>
                          <button
                            onClick={() => handleDownloadSummary(summary)}
                            style={{
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.6rem',
                              backgroundColor: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                            title="Download as text file"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleDeleteSummary(summary.id)}
                            style={{
                              padding: '0.2rem 0.4rem',
                              fontSize: '0.6rem',
                              backgroundColor: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '3px',
                              cursor: 'pointer'
                            }}
                            title="Delete this summary"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Content */}
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '1rem'
                  }}>
                    {editingId === summary.id ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{
                            width: '100%',
                            flex: 1,
                            minHeight: '200px',
                            backgroundColor: '#2a2a2a',
                            color: '#fff',
                            border: '2px solid #646cff',
                            borderRadius: '4px',
                            padding: '1rem',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            fontFamily: 'inherit',
                            resize: 'vertical'
                          }}
                          placeholder="Edit summary text..."
                        />
                        <div style={{
                          marginTop: '0.5rem',
                          display: 'flex',
                          gap: '0.5rem',
                          justifyContent: 'flex-end'
                        }}>
                          <button
                            onClick={() => cancelEdit()}
                            style={{
                              padding: '0.3rem 0.8rem',
                              backgroundColor: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.8rem'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(summary)}
                            disabled={!editText.trim()}
                            style={{
                              padding: '0.3rem 0.8rem',
                              backgroundColor: editText.trim() ? '#4ade80' : '#374151',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: editText.trim() ? 'pointer' : 'not-allowed',
                              fontSize: '0.8rem'
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{
                        flex: 1,
                        color: '#fff',
                        fontSize: '0.95rem',
                        lineHeight: '1.6',
                        padding: '1rem',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '4px',
                        overflow: 'auto'
                      }}>
                        {summary.summary_text}
                      </div>
                    )}
                  </div>

                  {/* Audio Section (if available) */}
                  {summary.audio && summary.audio.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{
                        color: '#fff',
                        fontSize: '0.9rem',
                        margin: '0 0 0.5rem 0'
                      }}>
                        Audio Summaries:
                      </h4>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}>
                        {summary.audio.map((audioItem) => (
                          <div key={audioItem.id} style={{
                            padding: '0.5rem',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '0.8rem'
                          }}>
                            Audio ({audioItem.audio_format}) - {Math.round(audioItem.audio_length_seconds)}s
                            <button
                              style={{
                                marginLeft: '0.5rem',
                                padding: '0.2rem 0.5rem',
                                backgroundColor: '#06b6d4',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                            >
                              Play
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
