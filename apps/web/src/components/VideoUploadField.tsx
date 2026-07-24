import { useEffect, useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { getPhotoUrl } from '../utils/photoUrl';

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  restaurantId: string;
  label?: string;
  height?: number;
  // Localized "or drag & drop / paste" hint under the empty dropzone.
  hint?: string;
};

// Pull the first video file out of a drag or paste payload.
function videoFromData(data: DataTransfer | null): File | null {
  if (!data) return null;
  if (data.files && data.files.length) {
    for (const f of Array.from(data.files)) if (f.type.startsWith('video/')) return f;
  }
  if (data.items && data.items.length) {
    for (const it of Array.from(data.items)) {
      if (it.kind === 'file' && it.type.startsWith('video/')) {
        const f = it.getAsFile();
        if (f) return f;
      }
    }
  }
  return null;
}

// Upload a video from the device (drag & drop / paste supported) and preview it
// playing live in the block. Mirrors PhotoUploadField; stores under the shared
// `invitation` uploads folder via the video endpoint.
export const VideoUploadField = ({ value, onChange, restaurantId, label, height = 150, hint = 'or drag & drop / paste' }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const hoverRef = useRef(false);
  const uploadingRef = useRef(false);

  const handleFile = async (file: File) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setError(null);
    setUploading(true);
    try {
      const [url] = await photoService.uploadVideo([file], restaurantId);
      onChange(url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  const handleRef = useRef(handleFile);
  handleRef.current = handleFile;

  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      if (!hoverRef.current) return;
      const f = videoFromData(e.clipboardData);
      if (f) { e.preventDefault(); handleRef.current(f); }
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = videoFromData(e.dataTransfer);
    if (f) handleFile(f);
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!rootRef.current || !rootRef.current.contains(e.relatedTarget as Node | null)) setDragOver(false);
  };

  const src = value ? (getPhotoUrl(value) ?? value) : null;

  return (
    <div
      ref={rootRef}
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      style={{ display: 'grid', gap: 6 }}
    >
      {label && <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        style={{ display: 'none' }}
      />
      {src ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height, background: '#000', border: dragOver ? '1px solid #c9a42c' : '1px solid rgba(255,255,255,0.08)' }}>
          <video src={src} controls muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              style={iconBtnStyle('rgba(201,164,44,0.9)', '#1a1a1a')} title="Replace">
              {uploading ? '…' : '↻'}
            </button>
            <button type="button" onClick={() => onChange(null)} disabled={uploading}
              style={iconBtnStyle('rgba(220,38,38,0.9)', '#fff')} title="Remove">×</button>
          </div>
          {dragOver && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(201,164,44,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, pointerEvents: 'none' }}>⬇</div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            height,
            borderRadius: 12,
            border: `1px dashed ${dragOver ? '#c9a42c' : 'rgba(167,139,250,0.4)'}`,
            background: dragOver ? 'rgba(124,58,237,0.14)' : 'rgba(124,58,237,0.06)',
            color: '#a78bfa',
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
            <rect x="2" y="5" width="14" height="14" rx="2" />
            <path d="m22 8-6 4 6 4V8Z" />
          </svg>
          {dragOver ? 'Drop video' : uploading ? 'Uploading…' : 'Upload video from device'}
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(167,139,250,0.7)', textTransform: 'none', letterSpacing: 0 }}>{hint}</span>
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
