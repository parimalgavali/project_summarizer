import { useRef, useState } from "react";
import { uploadDocument } from "../lib/api";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = [".pdf", ".docx", ".txt"];

interface UploadPanelProps {
  onUpload: (file: File) => void;
}

export default function UploadPanel({ onUpload }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});
  const [selectedFormat, setSelectedFormat] = useState<string>("short_text");

  const validate = (f: File) => {
    const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ACCEPT.includes(ext)) return "Only PDF, DOCX, TXT allowed.";
    if (f.size > MAX_BYTES) return "File too large (max 10MB).";
    return null;
  };

  const handleFile = async () => {
    if (!selectedFile) return;

    const v = validate(selectedFile);
    if (v) return setMsg({ err: v });

    setProgress(0);
    setMsg({});

    try {
      const res = await uploadDocument(selectedFile, setProgress, selectedFormat);
      setMsg({ ok: `${res.message || `Processed: ${res.filename}`}` });

      // Summary is now displayed in the Summaries tab
      onUpload(selectedFile);
      setSelectedFile(null);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch {
      setMsg({ err: "Upload failed" });
      setProgress(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setMsg({});
      setProgress(null);
    }
  };

  const formatOptions = [
    { value: "short_text", label: "Short Text" },
    { value: "bullet_points", label: "Bullet Points" },
    { value: "academic_tone", label: "Academic Tone" }
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '1rem',
      marginTop: '2rem',
      width: '100%',
      maxWidth: '1200px',
      padding: '0 2rem'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1rem'
      }}>
        <label style={{ color: '#fff' }}>Summary Format:</label>
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          style={{
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #333',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            width: '200px'
          }}
        >
          {formatOptions.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{
          borderRadius: '8px',
          border: '1px solid transparent',
          padding: '0.6em 1.2em',
          fontSize: '1em',
          fontWeight: 500,
          fontFamily: 'inherit',
          backgroundColor: '#2a2a2a',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: '#fff'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#646cff';
          e.currentTarget.style.backgroundColor = '#333';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.backgroundColor = '#2a2a2a';
        }}
        >
          Choose File
          <input
            ref={inputRef}
            type="file"
            onChange={handleChange}
            style={{ display: 'none' }}
          />
        </label>

        <button
          onClick={handleFile}
          disabled={!selectedFile}
          style={{
            borderRadius: '8px',
            border: '1px solid transparent',
            padding: '0.6em 1.2em',
            fontSize: '1em',
            fontWeight: 500,
            fontFamily: 'inherit',
            backgroundColor: selectedFile ? '#2a2a2a' : '#0a0a0a',
            cursor: selectedFile ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            color: selectedFile ? '#fff' : '#666',
            opacity: selectedFile ? 1 : 0.5
          }}
          onMouseEnter={(e) => {
            if (selectedFile) {
              e.currentTarget.style.borderColor = '#646cff';
              e.currentTarget.style.backgroundColor = '#333';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedFile) {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = '#2a2a2a';
            }
          }}
        >
          Upload
        </button>

        {selectedFile && (
          <button
            onClick={() => {
              setSelectedFile(null);
              setMsg({});
              setProgress(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            style={{
              borderRadius: '8px',
              border: '1px solid transparent',
              padding: '0.6em 1.2em',
              fontSize: '1em',
              fontWeight: 500,
              fontFamily: 'inherit',
              backgroundColor: '#2a2a2a',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: '#fff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.backgroundColor = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.backgroundColor = '#2a2a2a';
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {selectedFile && !progress && (
        <p style={{ color: '#888', margin: 0 }}>
          Selected: {selectedFile.name}
        </p>
      )}

      {progress !== null && (
        <div style={{
          width: '340px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #333'
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              backgroundColor: '#646cff',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <p style={{ color: '#888', margin: 0, textAlign: 'center', fontSize: '0.9em' }}>
            {progress}%
          </p>
        </div>
      )}

      {msg.ok && <p style={{ color: '#4ade80', margin: 0 }}>{msg.ok}</p>}
      {msg.err && <p style={{ color: '#ef4444', margin: 0 }}>{msg.err}</p>}
    </div>
  );
}
