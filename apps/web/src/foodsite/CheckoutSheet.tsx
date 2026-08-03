import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatSum } from '../utils/currency';
import { dishName } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { publicOrderService } from '../services/order.service';
import { useCartStore } from './cart.store';
import { useOrderSession } from './order.store';
import { useCartLines } from './useCartLines';
import { Price, useDismissible, useT } from './ui';

// ── Checkout ────────────────────────────────────────────────────────────────
// Sends the order for real. The body carries ids and quantities only — the
// server resolves names and prices from the live menu and snapshots them onto
// the order, so nothing here can name its own price.
//
// On success the cart is emptied and the guest's device token is stored; from
// that moment the site is in "order in progress" mode and the code takes over
// the screen (ActiveOrderPanel).

export function CheckoutSheet({
  restaurantId, menuItems, onClose,
}: {
  restaurantId: string; menuItems: MenuItem[]; onClose: () => void;
}) {
  const { t, locale } = useT();
  const { lines, subtotal } = useCartLines(menuItems);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();
  const clearCart = useCartStore((s) => s.clear);
  const startSession = useOrderSession((s) => s.start);
  useDismissible(true, onClose);

  const payable = lines.filter((l) => !l.outOfStock);

  const place = useMutation({
    mutationFn: () => publicOrderService.place({
      restaurantId,
      comment: comment.trim() || null,
      items: payable.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
    }),
    onSuccess: (order) => {
      // Order of operations matters: register the session BEFORE clearing the
      // cart, so there is never a frame where the guest has neither a cart nor
      // an order and the site looks like it lost their food.
      startSession(restaurantId, order.guestToken);
      queryClient.setQueryData(['fs-order', order.guestToken], order);
      clearCart();
    },
  });

  const canSubmit = payable.length > 0 && !place.isPending;
  const sent = place.isSuccess;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    place.mutate();
  };

  return (
    <>
      <div className="fs-backdrop" style={{ zIndex: 70 }} onClick={onClose} />
      <div className="fs-sheet" style={{ zIndex: 71 }} role="dialog" aria-modal="true" aria-label={t('fs_checkout')}>
        {sent ? (
          <div style={{ padding: '30px 26px 28px', display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
            <span className="fs-eyebrow">{t('fs_show_this_code')}</span>
            <strong style={{
              fontSize: 'clamp(56px, 20vw, 88px)', fontWeight: 800, lineHeight: 1,
              letterSpacing: '0.12em', paddingLeft: '0.12em',
              color: 'var(--fs-accent)', fontVariantNumeric: 'tabular-nums',
            }}>
              {place.data?.code}
            </strong>
            <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, maxWidth: 380 }}>
              {t('fs_code_hint')}
            </p>
            <button type="button" className="fs-btn fs-btn-primary" style={{ marginTop: 6 }} onClick={onClose}>
              {t('fs_back_to_menu')}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ padding: '18px 20px 22px', display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 className="fs-title" style={{ fontSize: 19, flex: 1 }}>{t('fs_checkout')}</h2>
              <button type="button" className="fs-btn fs-btn-icon" aria-label={t('fs_close')} onClick={onClose}>✕</button>
            </div>

            <label>
              <span className="fs-label">{t('fs_comment')}</span>
              <textarea className="fs-textarea" value={comment} placeholder={t('fs_comment_hint')}
                onChange={(e) => setComment(e.target.value)} />
            </label>

            <div style={{ display: 'grid', gap: 7, padding: '13px 14px', borderRadius: 12, background: 'var(--fs-surface)' }}>
              {payable.map(({ item, qty, lineTotal }) => (
                <div key={item.id} style={{ display: 'flex', gap: 10, fontSize: 13.5 }}>
                  <span className="fs-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{qty}×</span>
                  <span style={{ flex: 1, minWidth: 0 }}>{dishName(item, locale)}</span>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatSum(lineTotal)}</span>
                </div>
              ))}
              <hr className="fs-rule" style={{ margin: '4px 0' }} />
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
                <span className="fs-label" style={{ marginBottom: 0 }}>{t('total')}</span>
                <Price tiyin={subtotal} size={23} />
              </div>
            </div>

            {place.isError && (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--fs-danger)', lineHeight: 1.5 }}>
                {errorMessage(place.error) ?? t('fs_order_failed')}
              </p>
            )}

            <button type="submit" className="fs-btn fs-btn-primary" disabled={!canSubmit}>
              {place.isPending ? <span className="fs-spinner" /> : t('fs_send_order')}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

// The server explains *why* an order was refused — a dish sold out, the menu
// changed — and that is far more useful to a guest than a generic failure.
function errorMessage(error: unknown): string | null {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : null;
}
