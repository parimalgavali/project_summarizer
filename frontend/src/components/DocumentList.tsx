import { useState, useEffect } from "react";
import { useDeleteDocument } from "../lib/queries";

interface BackendDocument {
  id: string;
  filename: string;
  file_size: number;
  extraction_status: string;
  word_count: number | null;
  created_at: string | null;
}

interface DocumentListProps {
  documents: BackendDocument[];
  onNavigateToSummaries?: (documentId: string, documentFilename: string) => void;
}

export default function DocumentList({ documents, onNavigateToSummaries }: DocumentListProps) {
  const deleteDocumentMutation = useDeleteDocument();
  const [filteredDocs, setFilteredDocs] = useState<BackendDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof BackendDocument>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


  // Filter and sort documents
  useEffect(() => {
    const filtered = documents.filter(doc =>
      doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort documents
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredDocs(filtered);
  }, [searchTerm, sortField, sortDirection, documents]);

  const handleSort = (field: keyof BackendDocument) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getSortIcon = (field: keyof BackendDocument) => {
    if (sortField !== field) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const handleDelete = async (documentId: string, filename: string) => {
    if (window.confirm(`Are you sure you want to delete "${filename}" and all its summaries?`)) {
      try {
        await deleteDocumentMutation.mutateAsync(documentId);
      } catch (error) {
        console.error('Failed to delete document:', error);
        alert('Failed to delete document. Please try again.');
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
          placeholder="Search documents..."
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
        <div style={{ color: '#888' }}>
          {documents.length} document{documents.length !== 1 ? 's' : ''} total
        </div>
      </div>

      {filteredDocs.length === 0 ? (
        <p style={{ color: '#888', padding: '2rem' }}>
          {searchTerm ? 'No documents match your search.' : 'No documents uploaded yet.'}
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
                onClick={() => handleSort('filename')}
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
                Filename{getSortIcon('filename')}
              </th>
              <th
                onClick={() => handleSort('extraction_status')}
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
                Status{getSortIcon('extraction_status')}
              </th>
              <th
                onClick={() => handleSort('file_size')}
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
                Size{getSortIcon('file_size')}
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
            {filteredDocs.map((doc, index) => (
              <tr
                key={doc.id}
                style={{
                  borderBottom: index === filteredDocs.length - 1 ? 'none' : '1px solid #333',
                  backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#222'
                }}
              >
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  {doc.filename}
                </td>
                <td style={{
                  padding: '1rem',
                  color: doc.extraction_status === 'extracted' ? '#4ade80' : '#f59e0b',
                  fontSize: '0.95rem',
                  fontWeight: '500'
                }}>
                  {doc.extraction_status}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {formatFileSize(doc.file_size)}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#888',
                  fontSize: '0.95rem'
                }}>
                  {formatDate(doc.created_at || '')}
                </td>
                <td style={{
                  padding: '1rem',
                  color: '#fff',
                  fontSize: '0.95rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {onNavigateToSummaries && (
                      <button
                        onClick={() => onNavigateToSummaries(doc.id, doc.filename)}
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
                        View Summaries
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id, doc.filename)}
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
    </div>
  );
}
