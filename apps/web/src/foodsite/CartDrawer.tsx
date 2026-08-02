import { useState } from 'react';
import { formatSum } from '../utils/currency';
import { dishName } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { useCartStore } from './cart.store';
import { useCartLines } from './useCartLines';
import { CheckoutSheet } from './CheckoutSheet';
import { Lightbox } from './Lightbox';
import { DishThumb, Price, Stepper, useDismissible, useT } from './ui';

export function CartDrawer({
  restaurantId, menuItems, onClose,
}: {
  restaurantId: string; menuItems: MenuItem[]; onClose: () => void;
}) {
  const { t, locale } = useT();
  const { lines, count, subtotal, hasOutOfStock } = useCartLines(menuItems);
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const [checkout, setCheckout] = useState(false);
  const [zoomed, setZoomed] = useState<{ photoUrl: string; name: string } | null>(null);
  // Stand down from Escape while a photo is open on top.
  useDismissible(true, onClose, !zoomed && !checkout);

  return (
    <>
      <div className="fs-backdrop" onClick={onClose} />
      <aside className="fs-drawer" role="dialog" aria-modal="true" aria-label={t('fs_cart')}>
        <header style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px', borderBottom: '1px solid var(--fs-line)',
        }}>
          <h2 className="fs-title" style={{ fontSize: 19, flex: 1 }}>{t('fs_cart')}</h2>
          {count > 0 && (
            <button type="button" className="fs-btn fs-btn-danger" style={{ padding: '7px 12px', fontSize: 12.5 }}
              onClick={clear}>
              {t('fs_clear_cart')}
            </button>
          )}
          <button type="button" className="fs-btn fs-btn-icon" aria-label={t('fs_close')} onClick={onClose}>✕</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: lines.length ? '10px 14px 18px' : 0 }}>
          {lines.length === 0 && (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column', gap: 8,
              alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 30,
            }}>
              <span style={{ fontSize: 38, opacity: 0.35 }}>🛒</span>
              <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{t('fs_cart_empty')}</p>
              <p className="fs-muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, maxWidth: 260 }}>
                {t('fs_cart_empty_hint')}
              </p>
            </div>
          )}

          {lines.map(({ item, qty, lineTotal, outOfStock }) => (
            <div key={item.id} style={{
              display: 'flex', gap: 11, padding: '11px 0',
              borderBottom: '1px solid var(--fs-line-soft)', opacity: outOfStock ? 0.6 : 1,
            }}>
              <button
                type="button"
                onClick={() => item.photoUrl && setZoomed({ photoUrl: item.photoUrl, name: dishName(item, locale) })}
                disabled={!item.photoUrl}
                aria-label={item.photoUrl ? t('fs_view_photo') : dishName(item, locale)}
                style={{
                  position: 'relative', width: 62, height: 62, flexShrink: 0, padding: 0,
                  borderRadius: 10, overflow: 'hidden', border: 0, background: 'transparent',
                  cursor: item.photoUrl ? 'zoom-in' : 'default',
                }}
              >
                <DishThumb photoUrl={item.photoUrl} name={dishName(item, locale)} ratio="1 / 1" dimmed={outOfStock} />
                {item.photoUrl && (
                  <span aria-hidden style={{
                    position: 'absolute', right: 3, bottom: 3, fontSize: 10, lineHeight: 1,
                    padding: '2px 3px', borderRadius: 5,
                    background: 'rgba(0,0,0,0.6)', color: 'var(--fs-text)',
                  }}>⤢</span>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 5 }}>
                <p style={{
                  margin: 0, fontSize: 14, fontWeight: 650, lineHeight: 1.3,
                  textDecoration: outOfStock ? 'line-through' : undefined,
                }}>
                  {dishName(item, locale)}
                </p>
                <p className="fs-muted" style={{ margin: 0, fontSize: 12 }}>
                  {formatSum(item.priceCents)}
                </p>

                {/* A dish that went out of stock while it sat in the cart is shown
                    and flagged, never dropped silently — the guest chose it. */}
                {outOfStock ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="fs-pill fs-pill-muted">{t('out_of_stock')}</span>
                    <button type="button" className="fs-btn fs-btn-danger"
                      style={{ padding: '5px 10px', fontSize: 12 }}
                      onClick={() => remove(item.id)}>
                      {t('fs_remove')}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Stepper
                      qty={qty}
                      label={dishName(item, locale)}
                      onAdd={() => setQty(item.id, qty + 1)}
                      onSetQty={(next) => setQty(item.id, next)}
                    />
                    <span style={{ fontSize: 14, fontWeight: 750, whiteSpace: 'nowrap' }}>
                      {formatSum(lineTotal)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {lines.length > 0 && (
          <footer style={{ padding: '14px 18px 18px', borderTop: '1px solid var(--fs-line)', display: 'grid', gap: 12 }}>
            {hasOutOfStock && (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fs-danger)', lineHeight: 1.5 }}>
                {t('fs_unavailable_note')}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <span className="fs-label" style={{ marginBottom: 0 }}>{t('fs_subtotal')}</span>
              <Price tiyin={subtotal} size={26} />
            </div>
            <button type="button" className="fs-btn fs-btn-primary" style={{ width: '100%' }}
              disabled={subtotal <= 0}
              onClick={() => setCheckout(true)}>
              {t('fs_place_order')}
            </button>
          </footer>
        )}
      </aside>

      {checkout && (
        <CheckoutSheet restaurantId={restaurantId} menuItems={menuItems} onClose={() => setCheckout(false)} />
      )}

      {zoomed && (
        <Lightbox photos={[zoomed.photoUrl]} index={0} alt={zoomed.name} onClose={() => setZoomed(null)} />
      )}
    </>
  );
}
