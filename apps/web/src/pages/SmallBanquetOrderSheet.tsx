import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
 *
 * **The order is BEHIND A CART BUTTON, and the menu gets the sheet.** It began
 * as a basket block above the dishes, on the reasoning that the total should not
 * be off the screen while the choosing happens — which was right about the total
 * and wrong about everything else: a party of forty orders a dozen dishes, so
 * the block grew to a third of the sheet and pushed the menu into a 52vh
 * letterbox, with the thing being decided (the food) given less room than the
 * record of the decision. Now the figures ride the footer where nothing can
 * scroll them away, and the lines themselves are one press behind the cart
 * button in the bottom-left corner — the same control the ordering site puts
 * there, where the person's hand already is.
 *
 * **And the menu is navigable.** A restaurant's list runs to several hundred
 * dishes across thirty-odd categories, and a single scroll through all of it is
 * how somebody orders the wrong thing. The categories are a rail beside the
 * dishes on a desktop and a snapping row above them on a tablet or phone, each
 * carrying how many dishes it holds and how many portions have been taken from
 * it — so "where did I pick things" is answered without opening the cart at all.
 * Pressing one SCROLLS to it rather than filtering: a filter would hide the
 * neighbouring courses somebody is comparing against, and the rail would then be
 * the only way back.
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
  /** The cart panel. Closed by default: the menu is what the sheet is for. */
  const [cartOpen, setCartOpen] = useState(false);
  /** Which category the menu is currently scrolled into, for the rail. */
  const [active, setActive] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  /** Portions taken from each category, for the rail's own badge. */
  const takenIn = useMemo(() => {
    const out: Record<string, number> = {};
    for (const item of chosen) out[item.category] = (out[item.category] ?? 0) + (lines[item.id] ?? 0);
    return out;
  }, [chosen, lines]);

  const setPortions = (id: string, next: number) =>
    setLines((prev) => {
      const out = { ...prev };
      if (next > 0) out[id] = next; else delete out[id];
      return out;
    });

  /**
   * Scroll the menu to a category.
   *
   * A position is SET rather than `scrollIntoView`'d, as the tier carousel's
   * centring is and for the same reason: that call scrolls every scrollable
   * ancestor, and this one has the dialog above it. `offsetTop` is read against
   * the scroller itself, which is why `.sbo-menu` is `position: relative`.
   */
  const goTo = (category: string) => {
    const box = menuRef.current;
    const section = sectionRefs.current[category];
    if (!box || !section) return;
    box.scrollTop = Math.max(0, section.offsetTop - 6);
    setActive(category);
  };

  /**
   * Which category the reader is in — the last one whose heading has passed the
   * top of the scroller, never the first one merely visible: at the foot of a
   * long category the next one's cards are on screen while the dishes being
   * read belong to this one.
   */
  const trackScroll = () => {
    const box = menuRef.current;
    if (!box) return;
    let current = grouped[0]?.category ?? null;
    for (const { category } of grouped) {
      const section = sectionRefs.current[category];
      if (!section) continue;
      if (section.offsetTop - box.scrollTop <= 12) current = category;
      else break;
    }
    setActive(current);
  };

  // A search rewrites the whole list, so the scroller goes back to the top and
  // the rail follows it. Keyed on the QUERY: keyed on `grouped` it would also
  // fire on the menu arriving, which is harmless, and on every re-render that
  // rebuilt the array, which is not.
  useEffect(() => {
    if (menuRef.current) menuRef.current.scrollTop = 0;
    setActive(null);
  }, [search]);

  /**
   * The rail's highlighted row. Falls back to the FIRST category rather than to
   * nothing: before a single scroll event the menu IS showing that category, and
   * a rail with nothing marked reads as a rail that does not work.
   */
  const activeCategory = active ?? grouped[0]?.category ?? null;

  /**
   * The page behind is held still for as long as the sheet is open.
   *
   * It covers the whole screen, and on a phone a scroll that runs off the end
   * of the menu otherwise chains to the floor map underneath — so the map
   * moves under a finger that is choosing dishes, and closing the sheet lands
   * somewhere nobody navigated to. The previous value is restored rather than
   * cleared, because this page is not the only thing that may have set it.
   */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Escape closes the cart and nothing else. The sheet itself is left alone:
  // an order half composed must not be dismissed by the key that shuts a panel.
  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCartOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cartOpen]);

  /**
   * THE SHEET IS PORTALLED TO THE BODY, and that is what makes it full-screen.
   *
   * It is rendered from the floor map, so in the tree it sits inside the
   * supervisor layout's page wrapper — and any ancestor carrying a transform,
   * a filter or `contain` becomes the containing block for a `position: fixed`
   * child, which makes `inset: 0` mean "the size of the PAGE" rather than "the
   * size of the screen". That is precisely what happened (see `.adm-page-in` in
   * index.css): on a phone the dialog came out 5312px tall and centred its card
   * far below the fold, so all anybody saw was the dark backdrop.
   *
   * The shared animation is fixed, so this is no longer the thing standing
   * between the sheet and the screen. It stays because a full-screen dialog
   * must not depend on what happens to be above it in the tree: the next
   * ancestor to grow a transform would break it again, silently, and only on
   * the long pages where it matters most. The palette travels with it —
   * `.sb-floor` declares every `--adm-*` token itself rather than inheriting
   * the section's, so nothing is lost by leaving the layout's scope.
   */
  return createPortal((
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

        {/* The menu, with the categories beside it. Two columns on a desktop,
            where the rail is a list; one on a tablet or phone, where it becomes
            a snapping row above the dishes. */}
        <div className="sbo-body">
          <aside className="sbo-side">
            <label className="sbo-field">
              <span className="adm-label" style={{ margin: 0 }}>{t('sbo_search')}</span>
              <input className="adm-input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <nav className="sbo-cats" aria-label={t('sbo_categories')}>
              {grouped.map(({ category, items }) => {
                const taken = takenIn[category] ?? 0;
                return (
                  <button key={category} type="button"
                    className={`sbo-cat${activeCategory === category ? ' is-on' : ''}`}
                    aria-current={activeCategory === category ? 'true' : undefined}
                    onClick={() => goTo(category)}>
                    <span className="sbo-cat-name">{t(CATEGORY_LABEL_KEY[category])}</span>
                    {/* How many dishes it holds, and — only once something has
                        been taken from it — how many portions. The rail is
                        then also the answer to "where did I pick things". */}
                    <span className="sbo-cat-n">{items.length}</span>
                    {taken > 0 && <span className="sbo-cat-taken">{taken}</span>}
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="sbo-menu" ref={menuRef} onScroll={trackScroll}>
            {isLoading && <p className="sbo-caption" style={{ margin: 0 }}>{t('loading')}</p>}
            {!isLoading && grouped.length === 0 && (
              <p className="sbo-caption" style={{ margin: 0 }}>{t('sbo_nothing_found')}</p>
            )}
            {grouped.map(({ category, items }) => (
              <section key={category} className="sbo-group"
                ref={(el) => { sectionRefs.current[category] = el; }}>
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
        </div>

        {error && <p className="sbo-error" role="alert">{error}</p>}

        {/* The footer is a row of the sheet's own grid, so the figures and both
            actions are on screen however long the menu is. */}
        <footer className="sbo-foot">
          <button type="button" className={`sbo-cart${cartOpen ? ' is-open' : ''}`}
            aria-expanded={cartOpen} onClick={() => setCartOpen((open) => !open)}>
            <span className="sbo-cart-icon" aria-hidden="true">🛒</span>
            <span className="sbo-cart-label">
              <span className="sbo-cart-word">{t('sbo_cart')}</span>
              {portions > 0 && <span className="sbo-cart-badge">{portions}</span>}
            </span>
            <strong className="sbo-cart-sum">{formatSum(total)}</strong>
          </button>

          <div className="sbo-foot-acts">
            <button type="button" className="adm-btn-ghost" onClick={onCancel}>{t('cancel')}</button>
            <button type="button" className="adm-btn-primary" disabled={busy || chosen.length === 0}
              onClick={() => onPlace({ lines, comment })}>
              {busy ? t('loading') : t('sbo_send')}
            </button>
          </div>

          {cartOpen && (
            <section className="sbo-cart-panel adm-card" aria-label={t('sbo_cart')}>
              <div className="sbo-cart-head">
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
                          {/* The same photo as the card, small: this list is
                              read back to the host, and a name alone is harder
                              to check against what was pointed at. */}
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

              {/* The note belongs to the ORDER, so it lives where the order is
                  reviewed rather than as a field among the dishes. */}
              <label className="sbo-field">
                <span className="adm-label" style={{ margin: 0 }}>{t('sbo_comment')}</span>
                <textarea className="adm-input" rows={2} value={comment} maxLength={500}
                  onChange={(e) => setComment(e.target.value)} />
              </label>

              <button type="button" className="adm-btn-ghost sbo-cart-close"
                onClick={() => setCartOpen(false)}>{t('sbo_close')}</button>
            </section>
          )}
        </footer>
      </div>

      {zoom && <Lightbox src={zoom} onClose={() => setZoom(null)} compact />}

      <style>{`
        .sbo-root {
          position: fixed; inset: 0; z-index: 9996; overflow: auto;
          display: flex; align-items: center; justify-content: center;
          padding: 20px 16px;
          background: rgba(var(--adm-bg-rgb), 0.92);
          color: var(--adm-text);
        }
        /* THE SHEET IS AS LONG AS THE SCREEN ALLOWS, and it is the MENU that
           scrolls inside it — three rows, head, body, footer, with only the
           middle one giving. A sheet that grew with its content put the actions
           and the order's total below the fold of a dialog that was already
           scrolling inside a page. 1180px because the dish grid wants four or
           five cards across beside the rail; 92vh so the dimmed map behind it
           still shows at the edges and nobody mistakes this for a page. */
        .sbo-sheet {
          width: 100%; max-width: 1180px; height: min(940px, 92vh);
          padding: 18px 18px 14px !important;
          display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 14px;
        }
        .sbo-head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .sbo-count {
          margin-left: auto; font-size: 13px; font-weight: 700; white-space: nowrap;
          color: var(--adm-accent);
        }
        .sbo-caption { font-size: 13px; color: rgba(var(--adm-text-rgb), 0.6); }
        .sbo-total { margin-left: auto; font-size: 18px; font-weight: 800; color: var(--adm-accent); }
        .sbo-lines, .sbo-group { display: grid; gap: 8px; }

        /* The categories beside the dishes. minmax(0, 1fr) on the menu, or
           the widest dish name decides how wide the column is and the grid
           overflows a card that cannot shrink below its min-content. */
        .sbo-body {
          display: grid; grid-template-columns: 216px minmax(0, 1fr);
          gap: 16px; min-height: 0;
        }
        .sbo-side { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; min-height: 0; }
        .sbo-cats { display: grid; gap: 4px; align-content: start; overflow: auto; min-height: 0; }
        .sbo-cat {
          display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 7px;
          align-items: center; width: 100%; min-height: 40px; padding: 7px 10px;
          border: 1px solid transparent; border-radius: 7px; cursor: pointer;
          background: transparent; color: rgba(var(--adm-text-rgb), 0.74);
          font: inherit; font-size: 13px; text-align: left;
          transition: background 0.14s, border-color 0.14s, color 0.14s;
        }
        .sbo-cat:hover { background: rgba(var(--adm-surface-rgb), 0.6); color: var(--adm-text); }
        /* The one being read is marked by a spine as well as a ground: on the
           phone rail there is no column for the ground to read as a position. */
        .sbo-cat.is-on {
          background: rgba(var(--adm-accent-rgb), 0.12);
          border-color: rgba(var(--adm-accent-rgb), 0.45);
          box-shadow: inset 2px 0 0 var(--adm-accent);
          color: var(--adm-text);
        }
        .sbo-cat-name {
          min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          font-weight: 600;
        }
        .sbo-cat-n { font-size: 11px; font-weight: 700; color: rgba(var(--adm-text-rgb), 0.4); }
        /* Portions taken from this category — the accent, because it is the
           only thing in the rail that is about the order rather than the menu. */
        .sbo-cat-taken {
          min-width: 20px; padding: 1px 6px; border-radius: 999px;
          background: var(--adm-accent); color: var(--adm-accent-ink);
          font-size: 11px; font-weight: 800; text-align: center;
        }

        /* position: relative is load-bearing: the rail reads each section's
           offsetTop against this box to scroll to it and to say which one is
           on screen, and offsetTop is measured from the offset PARENT. */
        .sbo-menu {
          display: grid; gap: 18px; align-content: start;
          position: relative; overflow: auto; min-height: 0; padding-right: 4px;
        }

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

        /* THE FOOTER: the cart in the corner, the two actions opposite it.
           position: relative is what the panel is anchored to. */
        .sbo-foot {
          position: relative; display: flex; align-items: center; gap: 12px;
          padding-top: 12px; border-top: 1px solid var(--adm-line);
        }
        .sbo-foot-acts { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }

        /* The cart button, in the bottom-left corner of the sheet — the place
           the ordering site puts it, which on a phone (where the sheet fills
           the screen) is the same corner of the same screen. It carries the
           figures itself, so the order's size and its total are legible without
           opening anything. */
        .sbo-cart {
          display: inline-flex; align-items: center; gap: 10px;
          min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(var(--adm-accent-rgb), 0.5);
          background: rgba(var(--adm-accent-rgb), 0.1);
          color: var(--adm-text); font: inherit; font-size: 13px; font-weight: 700;
          transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .sbo-cart:hover, .sbo-cart.is-open {
          background: rgba(var(--adm-accent-rgb), 0.18);
          border-color: var(--adm-accent);
          box-shadow: 0 0 0 1px rgba(var(--adm-accent-rgb), 0.35);
        }
        .sbo-cart-icon { font-size: 17px; line-height: 1; }
        .sbo-cart-label { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
        .sbo-cart-badge {
          min-width: 22px; padding: 1px 7px; border-radius: 999px;
          background: var(--adm-accent); color: var(--adm-accent-ink);
          font-size: 11.5px; font-weight: 800; text-align: center;
        }
        .sbo-cart-sum {
          color: var(--adm-accent); font-size: 14px; font-weight: 800;
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }

        /* The panel rises from the button it belongs to, and is OPAQUE: it sits
           over the dish grid, and anything see-through makes both unreadable at
           once (the same rule the cabinet's collapsed nav follows). */
        .sbo-cart-panel {
          position: absolute; left: 0; bottom: calc(100% + 10px); z-index: 5;
          width: min(520px, 100%); max-height: min(62vh, 540px); overflow: auto;
          display: grid; gap: 12px; padding: 14px !important;
          background: var(--adm-bg) !important;
          border: 1px solid rgba(var(--adm-accent-rgb), 0.4);
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
        }
        .sbo-cart-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .sbo-cart-close { justify-self: start; }
        /* IN THE CART, THE NAME IS THE ROW. A dish is read back to the host by
           its name, and the five-column row left it about 96px of a 470px panel
           — measured, "Very long dish name with a garnish" came out as four
           letters and an ellipsis. So the unit price goes (the card it was
           chosen from carries it, and the row's own total is beside the
           stepper) and the name may take a second line. */
        .sbo-cart-panel .sbo-line { grid-template-columns: auto minmax(0, 1fr) auto 92px; }
        .sbo-cart-panel .sbo-line > span.sbo-caption { display: none; }
        .sbo-cart-panel .sbo-line-name {
          white-space: normal; overflow-wrap: anywhere;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
        }
        .sbo-error {
          margin: 0; padding: 10px 14px; border-radius: 4px; font-size: 13px;
          color: #fecaca; background: rgba(220, 38, 38, 0.12); border: 1px solid rgba(220, 38, 38, 0.35);
        }
        /* ── Tablet and phone ────────────────────────────────────────────────
           The rail becomes a SNAPPING ROW above the dishes. A 216px column at
           860px leaves the grid two cards wide, and a tablet is what this
           screen is actually used on; a row across the top costs one line and
           keeps every category one press away. */
        @media (max-width: 900px) {
          .sbo-root { padding: 0; }
          /* Full screen, squared off: at this width the dimmed border around a
             dialog is a strip of nothing taken out of the menu. */
          /* OPAQUE at full screen. The adm-card surface is translucent, which is
             right when it floats over a dimmed map and wrong when it IS the
             screen: the page underneath showed faintly through the dish grid
             and the cart bar, which on a dark ground reads as a rendering
             fault rather than as depth. */
          .sbo-sheet {
            height: 100%; max-width: none; border-radius: 0 !important;
            background: var(--adm-bg) !important;
          }
          .sbo-body { grid-template-columns: minmax(0, 1fr); gap: 10px; }
          .sbo-side { grid-template-rows: auto auto; }
          .sbo-cats {
            display: flex; gap: 6px; overflow-x: auto; overflow-y: hidden;
            scroll-snap-type: x proximity; padding-bottom: 4px;
          }
          .sbo-cat { width: auto; flex: 0 0 auto; scroll-snap-align: start; }
          /* The spine was a left edge in a column; in a row it reads as a
             fragment, so the mark is the ground and the frame alone. */
          .sbo-cat.is-on { box-shadow: none; }
          .sbo-cat-name { white-space: nowrap; }
          /* Anchored to the sheet's own edges, so a 470px panel does not hang
             off a 390px screen. */
          .sbo-cart-panel { left: 0; right: 0; width: auto; max-height: 68vh; }
        }
        @media (max-width: 560px) {
          /* THE FOOTER BECOMES TWO ROWS: the cart across the top of it, the
             two actions below. In one row the actions were left 229px of a
             390px screen and the send button — a sentence in Russian and
             Uzbek — wrapped to two lines inside its own box, which is a
             primary action that looks broken. Measured at 390px before the
             fix: an 88px-tall actions box squeezed beside the cart.

             Across the whole width the cart is then the ordering site's own
             bottom bar, which is what it was asked to be. */
          .sbo-foot { gap: 8px; flex-wrap: wrap; }
          .sbo-cart { flex: 1 1 auto; justify-content: space-between; }
          .sbo-foot-acts { flex: 1 1 100%; margin-left: 0; gap: 8px; flex-wrap: nowrap; }
          .sbo-foot-acts button { flex: 1; }
          /* The line total goes; the panel's head already carries the order's. */
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
  ), document.body);
};
