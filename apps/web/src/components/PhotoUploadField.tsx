import { useEffect, useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { IMAGE_ACCEPT } from '../utils/uploadFormats';

type Props = {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  restaurantId: string;
  label?: string;
  height?: number;
  // Localized "or drag & drop / paste" hint under the empty dropzone.
  hint?: string;
};

// Pull the first image file out of a drag or paste payload.
function imageFromData(data: DataTransfer | null): File | null {
  if (!data) return null;
  if (data.files && data.files.length) {
    for (const f of Array.from(data.files)) if (f.type.startsWith('image/')) return f;
  }
  if (data.items && data.items.length) {
    for (const it of Array.from(data.items)) {
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) return f;
      }
    }
  }
  return null;
}

export const PhotoUploadField = ({ value, onChange, restaurantId, label, height = 140, hint = 'or drag & drop / paste' }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Hover flag drives the document-level paste handler (paste events don't reach
  // a non-editable element by focus, so we route them by which field is hovered).
  const hoverRef = useRef(false);
  const uploadingRef = useRef(false);

  const handleFile = async (file: File) => {
    if (uploadingRef.current) return;
    uploadingRef.current = true;
    setError(null);
    setUploading(true);
    try {
      const [url] = await photoService.uploadPhotos('invitation', [file], undefined, restaurantId);
      onChange(url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };
  // Keep the latest handler for the document paste listener (avoids stale onChange).
  const handleRef = useRef(handleFile);
  handleRef.current = handleFile;

  useEffect(() => {
    const onDocPaste = (e: ClipboardEvent) => {
      if (!hoverRef.current) return;
      const f = imageFromData(e.clipboardData);
      if (f) { e.preventDefault(); handleRef.current(f); }
    };
    document.addEventListener('paste', onDocPaste);
    return () => document.removeEventListener('paste', onDocPaste);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = imageFromData(e.dataTransfer);
    if (f) handleFile(f);
  };
  const onDragOver = (e: React.DragEvent) => {
    // Signal we accept the drop; without this the browser rejects it.
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragOver) setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    // Only clear when the pointer actually leaves the field (not a child).
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
        accept={IMAGE_ACCEPT}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        style={{ display: 'none' }}
      />
      {src ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height, background: 'rgba(var(--adm-bg-rgb),0.5)', border: dragOver ? '1px solid var(--adm-accent)' : '1px solid rgba(255,255,255,0.08)' }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
              style={iconBtnStyle('rgba(var(--adm-accent-rgb),0.9)', '#1a1a1a')}>
              {uploading ? '…' : '↻'}
            </button>
            <button type="button" onClick={() => onChange(null)} disabled={uploading}
              style={iconBtnStyle('rgba(220,38,38,0.9)', '#fff')}>×</button>
          </div>
          {dragOver && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(var(--adm-accent-rgb),0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, pointerEvents: 'none' }}>⬇</div>
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
            border: `1px dashed ${dragOver ? 'var(--adm-accent)' : 'rgba(var(--adm-accent-rgb),0.35)'}`,
            background: dragOver ? 'rgba(var(--adm-accent-rgb),0.14)' : 'rgba(var(--adm-accent-rgb),0.05)',
            color: 'var(--adm-accent)',
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 600,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {dragOver ? 'Drop image' : uploading ? 'Uploading…' : 'Upload from device'}
          <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(var(--adm-accent-rgb),0.65)', textTransform: 'none', letterSpacing: 0 }}>{hint}</span>
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
    cursor: 'pointer', fontWeight: 700, fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  };
}
