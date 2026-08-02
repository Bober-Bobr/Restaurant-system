import { dishName, dishDescription } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { useCartStore } from './cart.store';
import { DishThumb, Price, Stepper, useDismissible, useT } from './ui';

// Full dish sheet. Everything the card shows, unclamped, plus the same stepper —
// a guest who opened a dish to read it should not have to close it to order.
export function DishModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const { t, locale } = useT();
  const qty = useCartStore((s) => s.lines[item.id] ?? 0);
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);
  useDismissible(true, onClose);

  const name = dishName(item, locale);
  const description = dishDescription(item, locale);
  const outOfStock = !!item.isOutOfStock;

  return (
    <>
      <div className="fs-backdrop" onClick={onClose} />
      <div className="fs-sheet" role="dialog" aria-modal="true" aria-label={name}>
        <div style={{ position: 'relative' }}>
          <DishThumb photoUrl={item.photoUrl} name={name} ratio="16 / 10" dimmed={outOfStock} />
          <button
            type="button"
            className="fs-btn fs-btn-icon fs-glass"
            aria-label={t('fs_close')}
            onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12 }}
          >
            ✕
          </button>
          {item.isBestseller && !outOfStock && (
            <span className="fs-pill" style={{ position: 'absolute', top: 14, left: 14 }}>★ {t('bestseller')}</span>
          )}
        </div>

        <div style={{ padding: '18px 20px 22px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ minWidth: 0 }}>
              <Price tiyin={item.priceCents} size={36} />
              <h2 style={{ margin: '5px 0 0', fontSize: 19, fontWeight: 750, lineHeight: 1.25 }}>{name}</h2>
            </div>
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

          {description && (
            <p className="fs-muted" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.62 }}>{description}</p>
          )}
        </div>
      </div>
    </>
  );
}
