import { useEffect, type ReactNode } from 'react';

// ── Phone-sized full-screen preview ──────────────────────────────────────────
// The frame the promotional site and the pricing page both open a live design
// into: a phone-proportioned panel, a close button, Escape, and a body scroll
// lock so the page behind does not move while the preview is open.
//
// `footer` is what differs between the two callers — the pricing page pins a
// "select" action under the preview, the promotional gallery shows none.

export function PreviewShell({ onClose, footer, header, brandStyle, children }: {
  onClose: () => void;
  footer?: ReactNode;
  /** Name / price strip above the preview, in the design's own colours. */
  header?: ReactNode;
  /** `brandVars()` for the template being shown — see templateBrand.ts. */
  brandStyle?: Record<string, string>;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="vi-overlay" onClick={onClose}>
      <div
        className="vi-pop"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)', height: 'min(860px, 92vh)',
          borderRadius: 22, overflow: 'hidden', position: 'relative',
          background: '#0b0f1c', boxShadow: 'var(--vi-shadow-lg)',
          display: 'flex', flexDirection: 'column',
          // The full view is framed in the design's own colour when one was
          // given, so opening a card does not drop the visitor back into the
          // site's blue the moment they look at what they picked.
          border: brandStyle ? '2px solid var(--tb-border)' : 'none',
          ...brandStyle,
        }}
      >
        {header && <div className="vi-pv-head">{header}</div>}
        {/* A block-designed invitation scrolls inside this panel; a rich one
            fills it and scrolls inside its own iframe. */}
        <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
          {children}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 12, zIndex: 5,
            width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(10,12,20,0.6)', color: '#fff', fontSize: 18, lineHeight: 1,
            backdropFilter: 'blur(6px)',
          }}
        >
          ✕
        </button>

        {/* Pinned under the preview rather than revealed by scrolling it: the
            template renders inside a sandboxed iframe on an opaque origin, so
            the parent cannot observe how far the visitor has scrolled inside
            it. A button that only appeared after an event we cannot detect
            would be a button that never appeared. */}
        {footer && (
          <div className="vi-pv-foot">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
