import { useState } from "react";

interface CustomNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customName: string) => void;
  defaultValue?: string;
  actionLabel: string;
}

export default function CustomNameModal({
  isOpen,
  onClose,
  onSave,
  defaultValue = "",
  actionLabel
}: CustomNameModalProps) {
  const [customName, setCustomName] = useState(defaultValue);

  const handleSave = () => {
    const trimmedName = customName.trim();
    if (trimmedName) {
      onSave(trimmedName);
      setCustomName("");
      onClose();
    }
  };

  const handleClose = () => {
    setCustomName("");
    onClose();
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
      zIndex: 2000
    }} onClick={handleClose}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #333',
        maxWidth: '500px',
        width: '90vw',
        padding: '2rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{
          margin: '0 0 1.5rem 0',
          color: '#fff',
          fontSize: '1.25rem'
        }}>
          Save with Custom Name
        </h3>

        <p style={{
          margin: '0 0 1.5rem 0',
          color: '#888',
          fontSize: '0.9rem'
        }}>
          Enter a custom name for this summary (optional):
        </p>

        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="e.g., Document Summary v1"
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '4px',
            border: '1px solid #333',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            fontSize: '1rem',
            marginBottom: '2rem'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              handleClose();
            }
          }}
          autoFocus
        />

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleClose}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#374151',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#4ade80',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
