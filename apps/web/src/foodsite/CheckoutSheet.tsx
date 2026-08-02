import { useState } from 'react';
import { formatSum } from '../utils/currency';
import { dishName } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { useCartLines } from './useCartLines';
import { Price, useDismissible, useT } from './ui';

// ── Checkout ────────────────────────────────────────────────────────────────
// PHASE 1: the form is real, the submit is not. Nothing is sent to the server —
// there is no orders endpoint yet — and the success screen says so plainly
// rather than imitating a placed order.
//
// The draft below is shaped like the eventual POST /api/public/orders body, so
// Phase 2 replaces `onSubmit` and nothing else.
type OrderDraft = {
  restaurantId: string;
  tableNumber: string;
  customerName: string;
  customerPhone: string;
  comment: string;
  items: { menuItemId: string; quantity: number; unitPriceCents: number }[];
};

export function CheckoutSheet({
  restaurantId, menuItems, onClose,
}: {
  restaurantId: string; menuItems: MenuItem[]; onClose: () => void;
}) {
  const { t, locale } = useT();
  const { lines, subtotal } = useCartLines(menuItems);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  useDismissible(true, onClose);

  const payable = lines.filter((l) => !l.outOfStock);
  const canSubmit = tableNumber.trim().length > 0 && payable.length > 0;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Assembled but deliberately not sent. Kept so the shape is exercised now
    // and the Phase 2 change is one line.
    const draft: OrderDraft = {
      restaurantId,
      tableNumber: tableNumber.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      comment: comment.trim(),
      items: payable.map((l) => ({
        menuItemId: l.item.id,
        quantity: l.qty,
        unitPriceCents: l.item.priceCents,
      })),
    };
    void draft;
    setSent(true);
  };

  return (
    <>
      <div className="fs-backdrop" style={{ zIndex: 70 }} onClick={onClose} />
      <div className="fs-sheet" style={{ zIndex: 71 }} role="dialog" aria-modal="true" aria-label={t('fs_checkout')}>
        {sent ? (
          <div style={{ padding: '34px 26px 30px', display: 'grid', gap: 12, justifyItems: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 42 }}>🧾</span>
            <h2 className="fs-title" style={{ fontSize: 21 }}>{t('fs_order_stub_title')}</h2>
            <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62, maxWidth: 380 }}>
              {t('fs_order_stub_body')}
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

            <div style={{ display: 'grid', gap: 12 }}>
              <label>
                <span className="fs-label">{t('fs_table_number')} *</span>
                <input className="fs-input" value={tableNumber} required inputMode="numeric"
                  onChange={(e) => setTableNumber(e.target.value)} />
              </label>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <label>
                  <span className="fs-label">{t('your_name')}</span>
                  <input className="fs-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </label>
                <label>
                  <span className="fs-label">{t('phone')}</span>
                  <input className="fs-input" type="tel" value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)} />
                </label>
              </div>
              <label>
                <span className="fs-label">{t('fs_comment')}</span>
                <textarea className="fs-textarea" value={comment} onChange={(e) => setComment(e.target.value)} />
              </label>
            </div>

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

            <button type="submit" className="fs-btn fs-btn-primary" disabled={!canSubmit}>
              {t('fs_send_order')}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
