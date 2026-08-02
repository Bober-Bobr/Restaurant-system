import { getPhotoUrl } from '../utils/photoUrl';
import { useDismissible, useT } from './ui';

// ── Full-screen photo viewer ────────────────────────────────────────────────
// Shared by the dish sheet, the cart lines and the hall gallery, so "tap a photo
// to see it properly" behaves identically everywhere. Sits above every other
// overlay (z 90) because it is always opened from on top of one.
//
// Arrows and the counter appear only for a real gallery; a single photo gets a
// clean frame with nothing to click but the way out.
export function Lightbox({
  photos, index, alt, onIndex, onClose,
}: {
  photos: string[];
  index: number;
  alt: string;
  onIndex?: (i: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  useDismissible(true, onClose);

  const many = photos.length > 1 && !!onIndex;
  const step = (delta: number) => onIndex?.((index + delta + photos.length) % photos.length);
  const current = photos[index];
  if (!current) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(0,0,0,0.94)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 4vw, 28px)',
        animation: 'fsFadeIn .2s ease both',
      }}
    >
      <button type="button" className="fs-btn fs-btn-icon fs-glass" aria-label={t('fs_close')}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
        ✕
      </button>

      {many && (
        <button type="button" className="fs-btn fs-btn-icon fs-glass" aria-label="‹"
          onClick={(e) => { e.stopPropagation(); step(-1); }} style={arrow('left')}>‹</button>
      )}

      <img
        src={getPhotoUrl(current)}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '100%', maxHeight: '88vh', objectFit: 'contain',
          borderRadius: 12, animation: 'fsFadeUp .25s cubic-bezier(.22,1,.36,1) both',
        }}
      />

      {many && (
        <button type="button" className="fs-btn fs-btn-icon fs-glass" aria-label="›"
          onClick={(e) => { e.stopPropagation(); step(1); }} style={arrow('right')}>›</button>
      )}

      {many && (
        <span className="fs-pill fs-pill-muted" style={{
          position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        }}>
          {index + 1} / {photos.length}
        </span>
      )}
    </div>
  );
}

// Tucked to the screen edge on a phone, where a 48px control in the middle would
// cover the photo it is meant to help you look at.
function arrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', [side]: 'clamp(6px, 2vw, 18px)', top: '50%',
    transform: 'translateY(-50%)', zIndex: 2,
    width: 46, height: 46, fontSize: 27, lineHeight: 1,
  };
}

/** The small ⤢ affordance overlaid on a tappable photo. */
export function ExpandHint({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      title={label}
      className="fs-glass"
      style={{
        position: 'absolute', right: 10, bottom: 10,
        width: 30, height: 30, borderRadius: 9,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--fs-line)', color: 'var(--fs-text)',
        fontSize: 13, pointerEvents: 'none',
      }}
    >
      ⤢
    </span>
  );
}
