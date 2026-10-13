import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { menuService } from '../services/menu.service';
import { CATEGORY_LABEL_KEY, CATEGORY_ORDER } from '../utils/menuCategories';
import { dishName } from '../utils/menuI18n';
import { formatSum } from '../utils/currency';
import type { MenuItem } from '../types/domain';
import type { Locale, translate } from '../utils/translate';

/**
 * The dish basket for a Small Banquets party that is eating à la carte.
 *
 * A booking taken on the floor map can be either kind of evening. A banquet is
 * priced by a table package and chosen in the kiosk; THIS is the other kind —
 * the host picks dishes and portions, and the result becomes an ordinary floor
 * order that a waiter takes and serves. So it is the food-service ordering flow
 * (a menu, steppers, a basket, a total) put in front of staff rather than a
 * guest, which is what "mirroring the ordering site" has to mean here: nobody
 * is holding a phone, and the portions are for a party of forty rather than a
 * table of four.
 *
 * **Portions, not quantities.** The same control, named for what it is: a
 * wedding orders eighty of something. The stepper is therefore not the only way
 * in — the number is typed, because nobody is pressing "+" eighty times.
 *
 * **It is priced by the SECTION'S OWN price column.** The dishes come from the
 * authenticated menu endpoint, which pins the scope from the caller's role
 * (`menuScopeForRole`), so a supervisor sees and sends the small-banquet price
 * and never the catering or banquet one. The server prices the order again from
 * the same column; nothing here is trusted with money.
 *
 * It wears the floor's dark green (`.sb-floor`), not the supervisor app's gold
 * or jade: this is the thing the waiter will be reading in an hour, and the two
 * screens being the same product is the point.
 */

type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

export type OrderSheetBooking = {
  eventNumber: number;
  customerName: string;
  /** The party's own time, already formatted by the caller — see `clockOf`. */
  when: string;
  guestCount: number;
};

export type OrderDraft = {
  /** menuItemId → portions. */
  lines: Record<string, number>;
  comment: string;
};

const MAX_PORTIONS = 99;

/** Portions for one dish, typed or stepped. */
const PortionField = ({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) => (
  <div className="sbo-stepper">
    <button type="button" className="adm-btn-ghost" aria-label="−" disabled={value <= 0}
      onClick={() => onChange(value - 1)}>−</button>
    <input className="adm-input" inputMode="numeric" aria-label={label}
      value={value === 0 ? '' : String(value)}
      placeholder="0"
      onChange={(e) => {
        const digits = e.target.value.replace(/[^\d]/g, '');
        onChange(digits === '' ? 0 : Math.min(MAX_PORTIONS, Number(digits)));
      }} />
    <button type="button" className="adm-btn-ghost" aria-label="+" disabled={value >= MAX_PORTIONS}
      onClick={() => onChange(value + 1)}>+</button>
  </div>
);

export const SmallBanquetOrderSheet = ({
  booking, t, locale, busy, error, onCancel, onPlace,
}: {
  booking: OrderSheetBooking;
  t: TFn;
  locale: Locale;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onPlace: (draft: OrderDraft) => void;
}) => {
  const [lines, setLines] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');

  // The section's own menu, at the section's own price: the endpoint pins the
  // scope from the role, so this asks for nothing and cannot be given another
  // product's prices.
  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['sbo-menu'],
    queryFn: () => menuService.list('smallBanquet'),
  });

  const sellable = useMemo(
    () => menuItems.filter((item) => item.isActive && !item.isOutOfStock),
    [menuItems],
  );

  const chosen = useMemo(
    () => sellable.filter((item) => (lines[item.id] ?? 0) > 0),
    [sellable, lines],
  );

  /** The whole menu by category, in the printed sheet's order. */
  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = query
      ? sellable.filter((item) => dishName(item, locale).toLowerCase().includes(query))
      : sellable;
    return CATEGORY_ORDER
      .map((category) => ({ category, items: matching.filter((item) => item.category === category) }))
      .filter((group) => group.items.length > 0);
  }, [sellable, search, locale]);

  const portions = chosen.reduce((sum, item) => sum + (lines[item.id] ?? 0), 0);
  const total = chosen.reduce((sum, item) => sum + item.priceCents * (lines[item.id] ?? 0), 0);

  const setPortions = (id: string, next: number) =>
    setLines((prev) => {
      const out = { ...prev };
      if (next > 0) out[id] = next; else delete out[id];
      return out;
    });

  return (
    <div className="sb-floor sbo-root" role="dialog" aria-modal="true" aria-label={t('sbo_title')}>
      <div className="sbo-sheet adm-card">
        <header className="sbo-head">
          <div>
            <h2 className="adm-title" style={{ margin: 0, fontSize: 22 }}>{t('sbo_title')}</h2>
            <p className="sbo-caption" style={{ margin: '4px 0 0' }}>
              {t('sbo_hint', { name: booking.customerName, when: booking.when })}
            </p>
          </div>
          <span className="sbo-count">
            #{booking.eventNumber}
            {booking.guestCount > 0 && ` · ${t('sbo_guests')}: ${booking.guestCount}`}
          </span>
        </header>

        {/* The basket first, because it is what the decision is about — and
            because on a long menu the total would otherwise be off the screen
            while the dishes are being picked. */}
        <section className="sbo-basket">
          <div className="sbo-basket-head">
            <span className="adm-label" style={{ margin: 0 }}>{t('sbo_chosen')}</span>
            <strong>{t('sbo_portions', { count: portions })}</strong>
            <span className="sbo-total">{formatSum(total)}</span>
          </div>
          {chosen.length === 0
            ? <p className="sbo-caption" style={{ margin: 0 }}>{t('sbo_empty')}</p>
            : (
              <div className="sbo-lines">
                {chosen.map((item) => (
                  <div key={item.id} className="sbo-line">
                    <span className="sbo-line-name">{dishName(item, locale)}</span>
                    <span className="sbo-caption">{formatSum(item.priceCents)}</span>
                    <PortionField value={lines[item.id] ?? 0} label={dishName(item, locale)}
                      onChange={(next) => setPortions(item.id, next)} />
                    <strong className="sbo-line-sum">{formatSum(item.priceCents * (lines[item.id] ?? 0))}</strong>
                  </div>
                ))}
              </div>
            )}
        </section>

        <label className="sbo-field">
          <span className="adm-label" style={{ margin: 0 }}>{t('sbo_search')}</span>
          <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>

        <div className="sbo-menu">
          {isLoading && <p className="sbo-caption" style={{ margin: 0 }}>{t('loading')}</p>}
          {!isLoading && grouped.length === 0 && (
            <p className="sbo-caption" style={{ margin: 0 }}>{t('sbo_nothing_found')}</p>
          )}
          {grouped.map(({ category, items }) => (
            <section key={category} className="sbo-group">
              <h3 className="adm-heading" style={{ margin: 0 }}>{t(CATEGORY_LABEL_KEY[category])}</h3>
              {items.map((item) => (
                <div key={item.id} className="sbo-line">
                  <span className="sbo-line-name">{dishName(item, locale)}</span>
                  <span className="sbo-caption">{formatSum(item.priceCents)}</span>
                  <PortionField value={lines[item.id] ?? 0} label={dishName(item, locale)}
                    onChange={(next) => setPortions(item.id, next)} />
                  <span />
                </div>
              ))}
            </section>
          ))}
        </div>

        <label className="sbo-field">
          <span className="adm-label" style={{ margin: 0 }}>{t('sbo_comment')}</span>
          <textarea className="adm-input" rows={2} value={comment} maxLength={500}
            onChange={(e) => setComment(e.target.value)} />
        </label>

        {error && <p className="sbo-error" role="alert">{error}</p>}

        <footer className="sbo-actions">
          <button type="button" className="adm-btn-ghost" onClick={onCancel}>{t('cancel')}</button>
          <button type="button" className="adm-btn-primary" disabled={busy || chosen.length === 0}
            onClick={() => onPlace({ lines, comment })}>
            {busy ? t('loading') : t('sbo_send')}
          </button>
        </footer>
      </div>

      <style>{`
        .sbo-root {
          position: fixed; inset: 0; z-index: 9996; overflow: auto;
          display: flex; align-items: flex-start; justify-content: center;
          padding: 24px 16px 48px;
          background: rgba(var(--adm-bg-rgb), 0.92);
          color: var(--adm-text);
        }
        .sbo-sheet {
          width: 100%; max-width: 720px; padding: 20px !important;
          display: grid; gap: 16px;
        }
        .sbo-head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .sbo-count {
          margin-left: auto; font-size: 13px; font-weight: 700; white-space: nowrap;
          color: var(--adm-accent);
        }
        .sbo-caption { font-size: 13px; color: rgba(var(--adm-text-rgb), 0.6); }
        .sbo-basket {
          display: grid; gap: 10px; padding: 14px; border-radius: 6px;
          border: 1px solid rgba(var(--adm-accent-rgb), 0.35);
          background: rgba(var(--adm-accent-rgb), 0.08);
        }
        .sbo-basket-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .sbo-total { margin-left: auto; font-size: 18px; font-weight: 800; color: var(--adm-accent); }
        .sbo-lines, .sbo-group { display: grid; gap: 8px; }
        .sbo-menu { display: grid; gap: 18px; max-height: 46vh; overflow: auto; padding-right: 4px; }
        /* A row is name · price · portions · line total. min-width: 0 on the
           name, or a long dish name makes the row wider than the sheet and the
           overflow is clipped with no scrollbar to say so. */
        .sbo-line {
          display: grid; grid-template-columns: minmax(0, 1fr) auto auto 92px;
          gap: 10px; align-items: center;
        }
        .sbo-line-name { font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sbo-line-sum { text-align: right; font-variant-numeric: tabular-nums; }
        .sbo-stepper { display: flex; align-items: center; gap: 6px; }
        /* ≥44px targets: this is pressed on a tablet, repeatedly. */
        .sbo-stepper button { min-width: 44px; min-height: 44px; }
        .sbo-stepper input { width: 64px; height: 44px; text-align: center; font-weight: 800; }
        .sbo-field { display: grid; gap: 6px; }
        .sbo-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
        .sbo-error {
          margin: 0; padding: 10px 14px; border-radius: 4px; font-size: 13px;
          color: #fecaca; background: rgba(220, 38, 38, 0.12); border: 1px solid rgba(220, 38, 38, 0.35);
        }
        @media (max-width: 560px) {
          /* The line total goes; the basket already carries the order's. */
          .sbo-line { grid-template-columns: minmax(0, 1fr) auto; }
          .sbo-line-sum, .sbo-line > span:nth-child(2) { display: none; }
          .sbo-stepper { grid-column: 1 / -1; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
};
