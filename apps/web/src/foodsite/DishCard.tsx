import { dishName, dishDescription } from '../utils/menuI18n';
import type { MenuItem } from '../types/domain';
import { useCartStore } from './cart.store';
import { DishThumb, Price, Stepper, useT } from './ui';

// ── The dish card ───────────────────────────────────────────────────────────
// Price first and large, name beneath it — the inversion this redesign is for.
// The card opens the dish sheet; the stepper on it swallows its own clicks.
export function DishCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const { t, locale } = useT();
  const qty = useCartStore((s) => s.lines[item.id] ?? 0);
  const add = useCartStore((s) => s.add);
  const setQty = useCartStore((s) => s.setQty);

  const name = dishName(item, locale);
  const description = dishDescription(item, locale);
  const outOfStock = !!item.isOutOfStock;

  return (
    <article
      className={`fs-card reveal${outOfStock ? '' : ' fs-card-lift'}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      style={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {item.isBestseller && !outOfStock && (
        <span className="fs-pill" style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
          ★ {t('bestseller')}
        </span>
      )}

      <div style={{ position: 'relative' }}>
        <DishThumb photoUrl={item.photoUrl} name={name} dimmed={outOfStock} />
        {outOfStock && (
          <span className="fs-pill fs-pill-muted" style={{
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          }}>
            {t('out_of_stock')}
          </span>
        )}
      </div>

      <div style={{ padding: '13px 14px 15px', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Price tiyin={item.priceCents} />
            <h3 className="fs-dish-name">{name}</h3>
          </div>

          {/* Reserve the control's width either way so cards in a row stay aligned. */}
          <div style={{ flexShrink: 0, minWidth: 34, display: 'flex', justifyContent: 'flex-end', paddingTop: 2 }}>
            {!outOfStock && (
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
          <p className="fs-muted fs-clamp-2" style={{ margin: '2px 0 0', fontSize: 12.5, lineHeight: 1.45 }}>
            {description}
          </p>
        )}
      </div>
    </article>
  );
}
