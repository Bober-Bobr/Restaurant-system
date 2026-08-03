import { useState } from 'react';
import { dishName, dishDescription } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { useCartStore } from './cart.store';
import { Lightbox, ExpandHint } from './Lightbox';
import { DishThumb, Price, Stepper, useDismissible, useT } from './ui';

// The dish sheet. Rises from the bottom of the screen: it is a phone-first
// surface, and a bottom sheet puts the controls under the thumb rather than
// under the eyes. On a wide screen it stays bottom-anchored but capped in width
// and centred, so the two layouts are the same object rather than two designs.
export function DishModal({ item, onClose, locked = false }: { item: MenuItem; onClose: () => void; locked?: boolean }) {
  const { t, locale } = useT();
  const qty = useCartStore((s) => s.lines[item.id] ?? 0);
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  const [zoomed, setZoomed] = useState(false);

  // Stand down from Escape while the photo viewer is on top, so one press
  // closes the photo and leaves the sheet where it was.
  useDismissible(true, onClose, !zoomed);

  const name = dishName(item, locale);
  const description = dishDescription(item, locale);
  const outOfStock = !!item.isOutOfStock;
  const canZoom = !!item.photoUrl;

  return (
    <>
      <div className="fs-backdrop" onClick={onClose} />
      <div className="fs-sheet" role="dialog" aria-modal="true" aria-label={name}>
        <span className="fs-grabber" aria-hidden />

        <div
          style={{ position: 'relative', cursor: canZoom ? 'zoom-in' : 'default' }}
          onClick={canZoom ? () => setZoomed(true) : undefined}
          role={canZoom ? 'button' : undefined}
          tabIndex={canZoom ? 0 : undefined}
          aria-label={canZoom ? t('fs_view_photo') : undefined}
          onKeyDown={canZoom ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setZoomed(true); }
          } : undefined}
        >
          <DishThumb photoUrl={item.photoUrl} name={name} ratio="16 / 10" dimmed={outOfStock} />
          {canZoom && <ExpandHint label={t('fs_view_photo')} />}
          {item.isBestseller && !outOfStock && (
            <span className="fs-pill" style={{ position: 'absolute', top: 14, left: 14 }}>★ {t('bestseller')}</span>
          )}
        </div>

        <button
          type="button"
          className="fs-btn fs-btn-icon fs-glass"
          aria-label={t('fs_close')}
          onClick={onClose}
          style={{ position: 'absolute', top: 18, right: 12, zIndex: 3 }}
        >
          ✕
        </button>

        <div style={{ padding: '18px 20px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <Price tiyin={item.priceCents} size={34} />
              <h2 style={{ margin: '5px 0 0', fontSize: 19, fontWeight: 750, lineHeight: 1.25 }}>{name}</h2>
            </div>
            <div style={{ flexShrink: 0, paddingTop: 4 }}>
              {outOfStock
                ? <span className="fs-pill fs-pill-muted">{t('out_of_stock')}</span>
                : (
                  <Stepper
                    qty={qty}
                    label={`${t('fs_add')} — ${name}`}
                    onAdd={() => add(item.id)}
                    onSetQty={(next) => setQty(item.id, next)}
                  />
                )}
            </div>
          </div>

          {description && (
            <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62 }}>{description}</p>
          )}
        </div>
      </div>

      {zoomed && item.photoUrl && (
        <Lightbox photos={[item.photoUrl]} index={0} alt={name} onClose={() => setZoomed(false)} />
      )}
    </>
  );
}
