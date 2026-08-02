import { useEffect } from 'react';
import { useAdminStore } from '../store/admin.store';
import { translate, type Locale, type TranslationKey } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { formatSum } from '../utils/currency';

// ── Small shared pieces of the food-service site ────────────────────────────

/** The house `t` shorthand, reading the locale the whole platform shares. */
export function useT(): { t: (k: TranslationKey) => string; locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useAdminStore();
  return { t: (k: TranslationKey) => translate(k, locale), locale, setLocale };
}

/** Price first, large, in the restaurant's accent — the redesign's whole premise. */
export function Price({ tiyin, size }: { tiyin: number; size?: number }) {
  // formatSum returns "45 000 so'm"; split so the unit can be de-emphasised
  // without duplicating the tiyin→so'm conversion here.
  const formatted = formatSum(tiyin);
  const idx = formatted.lastIndexOf(' ');
  const amount = idx > 0 ? formatted.slice(0, idx) : formatted;
  const unit = idx > 0 ? formatted.slice(idx + 1) : '';
  return (
    <span className="fs-price" style={size ? { fontSize: size } : undefined}>
      {amount}
      {unit && <span className="fs-price-unit">{unit}</span>}
    </span>
  );
}

/** Dish photo, or a generated tile when the restaurant never uploaded one.
 *  A photo-led design degrades badly on a text-only menu, and plenty of these
 *  menus are text-only — so the fallback keeps the same aspect ratio and the
 *  grid stays even. */
export function DishThumb({
  photoUrl, name, ratio = '4 / 3', dimmed = false, radius,
}: {
  photoUrl?: string | null; name: string; ratio?: string; dimmed?: boolean; radius?: string | number;
}) {
  const src = photoUrl ? getPhotoUrl(photoUrl) : null;
  const common: React.CSSProperties = {
    width: '100%', aspectRatio: ratio, display: 'block', borderRadius: radius,
    filter: dimmed ? 'grayscale(85%) brightness(0.55)' : undefined,
  };

  if (src) {
    return <img src={src} alt={name} loading="lazy" style={{ ...common, objectFit: 'cover' }} />;
  }
  return (
    <div
      aria-hidden
      style={{
        ...common,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(150deg, rgb(var(--fs-accent-rgb) / 0.16), rgba(255,255,255,0.02))',
      }}
    >
      <span style={{
        fontSize: 'clamp(30px, 8vw, 54px)', fontWeight: 800, letterSpacing: '-0.04em',
        color: 'transparent', WebkitTextStroke: '1.5px rgb(var(--fs-accent-rgb) / 0.5)',
      }}>
        {name.trim().charAt(0).toUpperCase() || '•'}
      </span>
    </div>
  );
}

/** Quantity control. Renders a round "+" until the dish is in the cart. */
export function Stepper({
  qty, onAdd, onSetQty, label,
}: {
  qty: number; onAdd: () => void; onSetQty: (qty: number) => void; label: string;
}) {
  // The card behind this is itself clickable (it opens the dish sheet), so every
  // control here has to stop the click from reaching it.
  const swallow = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); fn(); };

  if (qty <= 0) {
    return (
      <button type="button" className="fs-add" aria-label={label} onClick={swallow(onAdd)}>+</button>
    );
  }
  return (
    <div className="fs-stepper fs-pop" key={qty} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="−" onClick={swallow(() => onSetQty(qty - 1))}>−</button>
      <span>{qty}</span>
      <button type="button" aria-label="+" onClick={swallow(() => onSetQty(qty + 1))}>+</button>
    </div>
  );
}

/** Gold-standard section heading: accent bar, title, count, fading rule. */
export function SectionHeading({ title, meta }: { title: string; meta?: string }) {
  return (
    <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <span style={{ width: 4, height: 21, borderRadius: 2, background: 'var(--fs-accent)', flexShrink: 0 }} />
        <h2 className="fs-section-title">{title}</h2>
        {meta && <span style={{ fontSize: 12, color: 'var(--fs-faint)', whiteSpace: 'nowrap' }}>{meta}</span>}
      </div>
      <hr className="fs-rule" />
    </div>
  );
}

// Overlays nest — a photo viewer opens on top of the dish sheet, which is on top
// of the page. A naive per-overlay `body.style.overflow` save/restore breaks
// there: the inner one restores the value it captured and the page starts
// scrolling behind the outer one that is still open. So the lock is refcounted
// and only the outermost overlay actually restores it.
let scrollLockCount = 0;
let scrollLockPrevious = '';

function lockBodyScroll() {
  if (scrollLockCount++ === 0) {
    scrollLockPrevious = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlockBodyScroll() {
  if (--scrollLockCount <= 0) {
    scrollLockCount = 0;
    document.body.style.overflow = scrollLockPrevious;
  }
}

/**
 * Escape-to-close plus a body scroll lock, for drawers and sheets.
 * `escape` lets an overlay stand down while something is stacked on top of it,
 * so one Escape closes only the topmost layer rather than the whole stack.
 */
export function useDismissible(open: boolean, onClose: () => void, escape = true) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  useEffect(() => {
    if (!open || !escape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, escape, onClose]);
}

/** Full-page state used for loading / not-found, inside the themed shell. */
export function FullPageNote({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center', padding: 24,
    }}>
      <h1 className="fs-title">{title}</h1>
      {body && <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, maxWidth: 420, lineHeight: 1.6 }}>{body}</p>}
    </div>
  );
}
