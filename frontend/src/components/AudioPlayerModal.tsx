import { useState, useRef, useEffect } from 'react';
import type { Audio } from '../lib/api';
import { downloadAudio } from '../lib/api';

interface AudioPlayerModalProps {
  audio: Audio | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioPlayerModal({ audio, isOpen, onClose }: AudioPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Load audio when modal opens
  useEffect(() => {
    const loadAudio = async () => {
      if (!audio) return;
      try {
        console.log('Loading audio for:', audio.id);
        const blob = await downloadAudio(audio.id);
        console.log('Audio blob received, size:', blob.size);
        const url = URL.createObjectURL(blob);
        console.log('Audio URL created:', url);
        setAudioUrl(url);
      } catch (error) {
        console.error('Failed to load audio:', error);
      }
    };

    if (isOpen && audio) {
      loadAudio();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioUrl(null);
      }
    }
  }, [isOpen, audio]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      console.log('Audio loaded, duration:', dur);
      setDuration(dur);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!isOpen || !audio) return null;

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
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '500px',
        width: '90%',
        borderColor: '#646cff',
        borderStyle: 'solid',
        borderWidth: '2px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>Audio Player</h2>
          <button
            onClick={onClose}
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

        {/* Audio Info */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>{audio.document_filename}</h3>
          <p style={{ color: '#888', margin: 0 }}>
            {audio.summary_type} • {audio.audio_length_seconds.toFixed(1)}s • {audio.tts_model}
          </p>
        </div>

        {/* Hidden audio element */}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />
        )}

        {/* Progress Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#333',
              borderRadius: '4px',
              cursor: 'pointer',
              position: 'relative'
            }}
            onClick={handleProgressClick}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercentage}%`,
                backgroundColor: '#646cff',
                borderRadius: '4px',
                transition: 'width 0.1s ease'
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={togglePlayPause}
            disabled={!audioUrl}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: '#646cff',
              color: '#fff',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>

          <div style={{ color: '#fff', fontSize: '1.1rem', fontFamily: 'monospace' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        {/* Loading state */}
        {!audioUrl && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '1rem' }}>
            Loading audio...
          </div>
        )}
      </div>
    </div>
  );
}
