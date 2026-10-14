import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { menuService } from '../services/menu.service';
import { getPhotoUrl } from '../utils/photoUrl';
import { Lightbox } from '../components/ui/lightbox';
import { dishDescription } from '../utils/menuI18n';
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

/**
 * One dish, as a card.
 *
 * **The photograph is the point of the redesign.** A host choosing forty
 * portions of something is choosing food, and a list of names and prices is a
 * spreadsheet — the restaurant's own photo library is already attached to every
 * dish and nothing here was showing it. Tapping the photo opens it full size
 * (the kiosk's own `Lightbox`), because the thumbnail is a reminder rather than
 * a look at the plate.
 *
 * A dish with no photo gets a lettered tile rather than a grey box or a broken
 * image: half a menu photographed and half not is the normal state of a
 * restaurant's library, and the two have to sit in one grid without one looking
 * like a failure.
 */
const DishCard = ({ item, name, description, portions, onChange, onZoom, t }: {
  item: MenuItem;
  name: string;
  description?: string;
  portions: number;
  onChange: (next: number) => void;
  onZoom: (src: string) => void;
  t: TFn;
}) => {
  const src = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
  return (
    <article className={`sbo-card${portions > 0 ? ' is-on' : ''}`}>
      {src ? (
        <button type="button" className="sbo-shot" onClick={() => onZoom(src)} aria-label={name}>
          <img src={src} alt="" loading="lazy" decoding="async" />
          {portions > 0 && <span className="sbo-chip">{portions}</span>}
        </button>
      ) : (
        <div className="sbo-shot is-empty" aria-hidden="true">
          <span>{name.trim().slice(0, 1).toUpperCase() || '·'}</span>
          {portions > 0 && <span className="sbo-chip">{portions}</span>}
        </div>
      )}
      <div className="sbo-card-body">
        <p className="sbo-card-name" title={name}>{name}</p>
        {description && <p className="sbo-card-desc">{description}</p>}
        <p className="sbo-card-price">{formatSum(item.priceCents)}</p>
        <PortionField value={portions} onChange={onChange} label={name} />
      </div>
      <span className="sbo-card-total">
        {portions > 0 ? formatSum(item.priceCents * portions) : t('sbo_portions', { count: 0 })}
      </span>
    </article>
  );
};

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
  /** A dish photograph, full size. The thumbnail is a reminder, not a look. */
  const [zoom, setZoom] = useState<string | null>(null);

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
                {chosen.map((item) => {
                  const src = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                  return (
                    <div key={item.id} className="sbo-line">
                      {/* The same photo as the card above, small: the basket is
                          read back to the host, and a name alone is harder to
                          check against what was pointed at. */}
                      {src
                        ? <img className="sbo-thumb" src={src} alt="" loading="lazy" />
                        : <span className="sbo-thumb is-empty" aria-hidden="true" />}
                      <span className="sbo-line-name">{dishName(item, locale)}</span>
                      <span className="sbo-caption">{formatSum(item.priceCents)}</span>
                      <PortionField value={lines[item.id] ?? 0} label={dishName(item, locale)}
                        onChange={(next) => setPortions(item.id, next)} />
                      <strong className="sbo-line-sum">{formatSum(item.priceCents * (lines[item.id] ?? 0))}</strong>
                    </div>
                  );
                })}
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
              <h3 className="sbo-group-head">
                {t(CATEGORY_LABEL_KEY[category])}
                <span>{items.length}</span>
              </h3>
              <div className="sbo-grid">
                {items.map((item) => (
                  <DishCard key={item.id} item={item} t={t}
                    name={dishName(item, locale)}
                    description={dishDescription(item, locale)}
                    portions={lines[item.id] ?? 0}
                    onChange={(next) => setPortions(item.id, next)}
                    onZoom={setZoom} />
                ))}
              </div>
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

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} compact />}

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
        .sbo-menu { display: grid; gap: 18px; max-height: 52vh; overflow: auto; padding-right: 4px; }

        /* A category's heading, in the section's own eyebrow style rather than
           the admin heading's gold tick — this sheet is the floor's dark
           green, and the tick belongs to the banquet palette. */
        .sbo-group-head {
          margin: 0; display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--adm-accent);
          padding-bottom: 7px; border-bottom: 1px solid rgba(var(--adm-accent-rgb), 0.22);
        }
        .sbo-group-head span {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
          color: rgba(var(--adm-text-rgb), 0.45);
        }

        /* THE DISHES, as cards with their photographs.
           auto-fill with a floor of 150px: a tablet gets four across, a
           phone two, and nothing has to know which. */
        .sbo-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); }
        .sbo-card {
          display: grid; gap: 0; border-radius: 10px; overflow: hidden;
          /* Both of these, or the card is sized by its widest child and
             overflows the track it was given. */
          min-width: 0;
          border: 1px solid var(--adm-line);
          background: rgba(var(--adm-surface-rgb), 0.55);
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        /* A chosen dish is ringed, not merely counted: in a grid of twenty the
           badge alone is something you have to go looking for. */
        .sbo-card.is-on {
          border-color: var(--adm-accent);
          box-shadow: 0 0 0 1px var(--adm-accent), 0 8px 22px rgba(0, 0, 0, 0.3);
        }
        .sbo-shot {
          position: relative; display: block; width: 100%; aspect-ratio: 16 / 10;
          padding: 0; border: 0; background: rgba(var(--adm-bg-rgb), 0.55);
          cursor: zoom-in; overflow: hidden;
        }
        .sbo-shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
        /* No photograph: a lettered tile. Half a menu photographed and half
           not is the normal state of a restaurant's library, and a grey box
           among the photos reads as something that failed to load. */
        .sbo-shot.is-empty {
          display: flex; align-items: center; justify-content: center; cursor: default;
          background: linear-gradient(145deg, rgba(var(--adm-accent-rgb), 0.16), rgba(var(--adm-surface-rgb), 0.5));
        }
        .sbo-shot.is-empty span {
          font-size: 30px; font-weight: 800; color: rgba(var(--adm-accent-rgb), 0.55);
        }
        .sbo-chip {
          position: absolute; top: 7px; right: 7px; min-width: 26px; height: 26px;
          padding: 0 7px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          background: var(--adm-accent); color: var(--adm-accent-ink);
          font-size: 13px; font-weight: 800;
        }
        .sbo-card-body { display: grid; gap: 4px; padding: 9px 10px 10px; min-width: 0; }
        .sbo-card-name {
          margin: 0; font-size: 13.5px; font-weight: 700; line-height: 1.3;
          /* Two lines, then clipped: a long dish name must not be what decides
             how wide the card is. The full name is the title attribute. */
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden; min-width: 0; overflow-wrap: anywhere;
        }
        /* Two lines of description and no more: the card's height is what keeps
           the grid readable, and a paragraph here pushes the stepper about. */
        .sbo-card-desc {
          margin: 0; font-size: 11.5px; line-height: 1.35; color: rgba(var(--adm-text-rgb), 0.55);
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .sbo-card-price { margin: 2px 0 4px; font-size: 14px; font-weight: 800; color: var(--adm-accent); }
        .sbo-card-total {
          padding: 7px 10px; font-size: 12px; font-weight: 700; text-align: right;
          border-top: 1px solid var(--adm-line); color: rgba(var(--adm-text-rgb), 0.6);
          font-variant-numeric: tabular-nums;
        }
        .sbo-card.is-on .sbo-card-total { color: var(--adm-accent); background: rgba(var(--adm-accent-rgb), 0.08); }

        .sbo-thumb {
          width: 34px; height: 34px; border-radius: 6px; object-fit: cover; flex-shrink: 0;
          background: rgba(var(--adm-bg-rgb), 0.6);
        }
        .sbo-thumb.is-empty { display: inline-block; border: 1px dashed var(--adm-line); }
        /* A row is name · price · portions · line total. min-width: 0 on the
           name, or a long dish name makes the row wider than the sheet and the
           overflow is clipped with no scrollbar to say so. */
        .sbo-line {
          display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto 92px;
          gap: 10px; align-items: center;
        }
        .sbo-line-name { font-size: 14px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sbo-line-sum { text-align: right; font-variant-numeric: tabular-nums; }
        /* THE STEPPER MUST BE ABLE TO SHRINK.
           It was a flex row of two 44px buttons and a fixed 64px field — 164px
           that could not get narrower, inside a card track of 158px. A grid
           item cannot shrink below its min-content, so every card's CONTENT
           came out 26px wider than the card's own box and the names, prices
           and steppers hung out past the frame and over the next card. That is
           the whole of "the dish cards and the text within them shift to the
           right". Measured: card 158px, content 184px, 27px of spill on every
           one of them.

           So it is a three-column grid — button, FLEXIBLE field, button —
           which fits any width down to about 110px while the buttons keep
           their touch size. */
        .sbo-stepper {
          display: grid; grid-template-columns: 44px minmax(0, 1fr) 44px;
          gap: 6px; align-items: center; width: 100%; min-width: 0;
        }
        .sbo-stepper button { min-width: 0; min-height: 44px; padding: 0; }
        .sbo-stepper input {
          width: auto; min-width: 0; height: 44px; padding: 0 2px;
          text-align: center; font-weight: 800;
        }
        /* In the basket a row is name · price · stepper · total, so the
           stepper sits in an an auto column — which would size to the grid's
           min-content and squash the field to nothing. It gets a width there. */
        .sbo-line .sbo-stepper { width: 148px; }
        .sbo-field { display: grid; gap: 6px; }
        .sbo-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
        .sbo-error {
          margin: 0; padding: 10px 14px; border-radius: 4px; font-size: 13px;
          color: #fecaca; background: rgba(220, 38, 38, 0.12); border: 1px solid rgba(220, 38, 38, 0.35);
        }
        @media (max-width: 560px) {
          /* The line total goes; the basket already carries the order's. */
          .sbo-line { grid-template-columns: auto minmax(0, 1fr); }
          .sbo-line-sum, .sbo-line > span.sbo-caption { display: none; }
          .sbo-stepper { grid-column: 1 / -1; justify-content: flex-end; }
          /* Two dishes across at 390px, which keeps the photograph big enough
             to be worth showing. */
          /* Two across at 390px, which is ~155px each. The stepper's buttons
             come down to 40px there so the number still has room — the height,
             which is what a thumb actually needs, is unchanged. */
          .sbo-grid { grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 8px; }
          .sbo-card-desc { display: none; }
          .sbo-stepper { grid-template-columns: 40px minmax(0, 1fr) 40px; gap: 4px; }
        }
      `}</style>
    </div>
  );
};
