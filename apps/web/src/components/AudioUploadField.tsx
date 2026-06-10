import { useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { getPhotoUrl } from '../utils/photoUrl';

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  restaurantId: string;
  label?: string;
};

export const AudioUploadField = ({ value, onChange, restaurantId, label }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const [url] = await photoService.uploadAudio([file], restaurantId);
      onChange(url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const src = value ? (getPhotoUrl(value) ?? value) : null;

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {label && <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        style={{ display: 'none' }}
      />
      {src ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <audio src={src} controls style={{ flex: 1, height: 36, minWidth: 0 }} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            style={iconBtnStyle('rgba(201,164,44,0.9)', '#1a1a1a')} title="Replace">
            {uploading ? '…' : '↻'}
          </button>
          <button type="button" onClick={() => onChange(null)} disabled={uploading}
            style={iconBtnStyle('rgba(220,38,38,0.9)', '#fff')} title="Remove">×</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            height: 84,
            borderRadius: 12,
            border: '1px dashed rgba(201,164,44,0.35)',
            background: 'rgba(201,164,44,0.05)',
            color: '#c9a42c',
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          {uploading ? 'Uploading…' : 'Upload music from device'}
        </button>
      )}
      {error && <p style={{ margin: 0, fontSize: 11, color: '#fca5a5' }}>{error}</p>}
    </div>
  );
};

function iconBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: '50%',
    background: bg, color, border: 'none',
    cursor: 'pointer', fontWeight: 700, fontSize: 16, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  };
}
