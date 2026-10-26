import { useState, useEffect } from "react";
import type { Audio } from "../lib/api";
import { downloadAudio } from "../lib/api";
import {
  EMPTY_LIST,
  useAudios,
  useDeleteAudio,
  useDocuments,
  useGenerateAudio,
  useGenerateAudioFromDocument,
  useSummaries,
} from "../lib/queries";
import AudioPlayerModal from "./AudioPlayerModal";
import QueryStatus from "./QueryStatus";

export default function AudioList() {
  const audiosQuery = useAudios();
  const audios = audiosQuery.data ?? EMPTY_LIST;
  const summaries = useSummaries().data ?? EMPTY_LIST;
  const documents = useDocuments().data ?? EMPTY_LIST;
  const generateAudioMutation = useGenerateAudio();
  const generateFromDocumentMutation = useGenerateAudioFromDocument();
  const deleteAudioMutation = useDeleteAudio();
  const [filteredAudios, setFilteredAudios] = useState<Audio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Audio>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedSummaryId, setSelectedSummaryId] = useState<string>('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('short_text');
  const [modalTab, setModalTab] = useState<'summary' | 'document'>('summary');
  const [generating, setGenerating] = useState(false);
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Audio | null>(null);

  // Filter and sort audios
  useEffect(() => {
    const filtered = audios.filter(audio =>
      audio.document_filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort audios
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredAudios(filtered);
  }, [searchTerm, sortField, sortDirection, audios]);

  const handleSort = (field: keyof Audio) => {
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

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return `${mins}m ${secs}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.round(seconds % 60);
      return `${hours}h ${mins}m ${secs}s`;
    }
  };

  const getSortIcon = (field: keyof Audio) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const handleGenerateAudio = async () => {
    if (!selectedSummaryId) return;

    setGenerating(true);
    try {
      await generateAudioMutation.mutateAsync(selectedSummaryId);
      setGenerateModalOpen(false);
      setSelectedSummaryId('');
    } catch (error) {
      console.error('Failed to generate audio:', error);
      alert('Failed to generate audio. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateAudioFromDocument = async () => {
    if (!selectedDocumentId) return;

    setGenerating(true);
    try {
      await generateFromDocumentMutation.mutateAsync({
        documentId: selectedDocumentId,
        formatType: selectedFormat,
      });
      setGenerateModalOpen(false);
      setSelectedDocumentId('');
      setSelectedFormat('short_text');
    } catch (error) {
      console.error('Failed to generate audio from document:', error);
      alert('Failed to generate audio. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (audio: Audio) => {
    try {
      const blob = await downloadAudio(audio.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `summary_audio_${audio.id}.${audio.audio_format || 'audio'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download audio:', error);
      alert('Failed to download audio. Please try again.');
    }
  };

  const handleListen = (audio: Audio) => {
    setSelectedAudio(audio);
    setPlayerModalOpen(true);
  };

  const handleDeleteAudio = async (audioId: string) => {
    if (window.confirm('Are you sure you want to delete this audio?')) {
      try {
        await deleteAudioMutation.mutateAsync(audioId);
      } catch (error) {
        console.error('Failed to delete audio:', error);
        alert('Failed to delete audio. Please try again.');
      }
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
          placeholder="Search audios..."
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
            {audios.length} audio{audios.length !== 1 ? 's' : ''} total
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
            Generate Audio
          </button>
        </div>
      </div>

      {audiosQuery.isPending || (audiosQuery.isError && !audiosQuery.data) ? (
        <QueryStatus
          label="audios"
          isPending={audiosQuery.isPending}
          error={audiosQuery.error}
          onRetry={() => audiosQuery.refetch()}
        />
      ) : filteredAudios.length === 0 ? (
        <p style={{ color: '#888', padding: '2rem' }}>
          {searchTerm ? 'No audios match your search.' : 'No audios available.'}
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
                Summary Type{getSortIcon('summary_type')}
              </th>
              <th
                onClick={() => handleSort('audio_length_seconds')}
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
                Length{getSortIcon('audio_length_seconds')}
              </th>
              <th
                onClick={() => handleSort('tts_model')}
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
                TTS Model{getSortIcon('tts_model')}
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
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAudios.map((audio, index) => (
              <tr
                key={audio.id}
                style={{
                  borderBottom: index === filteredAudios.length - 1 ? 'none' : '1px solid #333',
                  backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#222'
                }}
              >
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  {audio.document_filename}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {audio.summary_type}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {formatDuration(audio.audio_length_seconds)}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {audio.tts_model}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {formatDate(audio.created_at)}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleDownload(audio)}
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
                      onClick={() => handleListen(audio)}
                      onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#16a34a'}
                      onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#22c55e'}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        backgroundColor: '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      Listen
                    </button>
                    <button
                      onClick={() => handleDeleteAudio(audio.id)}
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

      {/* Generate Audio Modal */}
      {generateModalOpen && (
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
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            borderColor: '#646cff',
            borderStyle: 'solid',
            borderWidth: '2px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ color: '#fff', margin: 0 }}>Generate Audio</h2>
              <button
                onClick={() => {
                  setGenerateModalOpen(false);
                  setSelectedSummaryId('');
                  setSelectedDocumentId('');
                  setSelectedFormat('short_text');
                  setModalTab('summary');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid #333' }}>
              <button
                onClick={() => {
                  setModalTab('summary');
                  setSelectedSummaryId('');
                  setSelectedDocumentId('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: modalTab === 'summary' ? '#646cff' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  borderBottom: modalTab === 'summary' ? '2px solid #646cff' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                From Existing Summary
              </button>
              <button
                onClick={() => {
                  setModalTab('document');
                  setSelectedSummaryId('');
                  setSelectedDocumentId('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: modalTab === 'document' ? '#646cff' : 'transparent',
                  color: '#fff',
                  border: 'none',
                  borderBottom: modalTab === 'document' ? '2px solid #646cff' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                From Document
              </button>
            </div>

            {modalTab === 'summary' && (
              <div>
                <h4 style={{ color: '#fff', marginBottom: '1rem' }}>Choose a summary to generate audio for</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflow: 'auto' }}>
                  {summaries.length === 0 ? (
                    <p style={{ color: '#888', padding: '1rem' }}>No summaries available</p>
                  ) : (
                    summaries.map((summary) => (
                      <button
                        key={summary.id}
                        onClick={() => setSelectedSummaryId(summary.id)}
                        style={{
                          padding: '1rem',
                          textAlign: 'left',
                          backgroundColor: selectedSummaryId === summary.id ? '#2a2a2a' : '#1a1a1a',
                          border: selectedSummaryId === summary.id ? '2px solid #646cff' : '1px solid #333',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500' }}>
                          {summary.document_filename}
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '0.8rem',
                          marginTop: '0.25rem'
                        }}>
                          {summary.summary_type} • {summary.summary_word_count} words • {summary.llm_model}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {modalTab === 'document' && (
              <div>
                <h4 style={{ color: '#fff', marginBottom: '1rem' }}>Choose a document and summary format</h4>

                {/* Format Selection */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                    Summary Format:
                  </label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #333',
                      backgroundColor: '#1a1a1a',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  >
                    <option value="short_text">Short Text Summary</option>
                    <option value="bullet_points">Bullet Points</option>
                    <option value="academic_tone">Academic Tone</option>
                  </select>
                </div>

                {/* Document Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflow: 'auto' }}>
                  {documents.filter(doc => doc.extraction_status === 'extracted').length === 0 ? (
                    <p style={{ color: '#888', padding: '1rem' }}>No processed documents available</p>
                  ) : (
                    documents.filter(doc => doc.extraction_status === 'extracted').map((document) => (
                      <button
                        key={document.id}
                        onClick={() => setSelectedDocumentId(document.id)}
                        style={{
                          padding: '1rem',
                          textAlign: 'left',
                          backgroundColor: selectedDocumentId === document.id ? '#2a2a2a' : '#1a1a1a',
                          border: selectedDocumentId === document.id ? '2px solid #646cff' : '1px solid #333',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '500' }}>
                          {document.filename}
                        </div>
                        <div style={{
                          color: '#888',
                          fontSize: '0.8rem',
                          marginTop: '0.25rem'
                        }}>
                          {document.word_count} words • {new Date(document.created_at || '').toLocaleDateString()}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setGenerateModalOpen(false);
                  setSelectedSummaryId('');
                  setSelectedDocumentId('');
                  setSelectedFormat('short_text');
                  setModalTab('summary');
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = '#6b7280'}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  backgroundColor: '#2a2a2a',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease'
                }}
              >
                Cancel
              </button>
              <button
                onClick={modalTab === 'summary' ? handleGenerateAudio : handleGenerateAudioFromDocument}
                disabled={(modalTab === 'summary' && !selectedSummaryId) || (modalTab === 'document' && !selectedDocumentId) || generating}
                onMouseEnter={(e) => {
                  if (((modalTab === 'summary' && selectedSummaryId) || (modalTab === 'document' && selectedDocumentId)) && !generating) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#4b5563';
                  }
                }}
                onMouseLeave={(e) => {
                  if (((modalTab === 'summary' && selectedSummaryId) || (modalTab === 'document' && selectedDocumentId)) && !generating) {
                    (e.target as HTMLButtonElement).style.backgroundColor = '#646cff';
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: ((modalTab === 'summary' && selectedSummaryId) || (modalTab === 'document' && selectedDocumentId)) && !generating ? '#646cff' : '#4b5563',
                  color: '#fff',
                  cursor: ((modalTab === 'summary' && selectedSummaryId) || (modalTab === 'document' && selectedDocumentId)) && !generating ? 'pointer' : 'not-allowed',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {generating ? 'Generating...' : 'Generate Audio'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Player Modal */}
      <AudioPlayerModal
        audio={selectedAudio}
        isOpen={playerModalOpen}
        onClose={() => {
          setPlayerModalOpen(false);
          setSelectedAudio(null);
        }}
      />
    </div>
  );
}
