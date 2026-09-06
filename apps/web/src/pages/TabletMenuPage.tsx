import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { Locale, locales, translate } from '../utils/translate';
import type { MenuItem, TableCategory, TableCategoryPackageItem, TableEventType } from '../types/domain';
import { isFreeChoice, isPaidExtra, tabletStatusOf } from '../utils/tabletStatus';
import { getPhotoUrl } from '../utils/photoUrl';
import { tabletThemeVars } from '../utils/tabletTheme';
import { dishName } from '../utils/menuI18n';
import { Lightbox } from '../components/ui/lightbox';
import { formatSum } from '../utils/currency';
import { tableCategoryLabel, tableCategoryPrice } from '../utils/tableCategoryLabel';
import { soleHallId } from '../utils/soleHall';
import { startTabletMusic, isTabletWelcomeShown, markTabletWelcomeShown, isTabletMusicStarted, pauseTabletMusic, resumeTabletMusic } from '../utils/tabletMusic';
import { FingerTrail, type TrailTemplate } from '../components/FingerTrail';
import { ParticleField, type ParticleKind } from '../blocks/ParticleField';
import { useScrollReveal } from '../utils/useScrollReveal';

type MenuCategory = MenuItem['category'];
type TFn = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

const CATEGORY_ORDER: Record<MenuCategory, number> = {
  SOUPS: 0, PIZZA: 1, COLD_APPETIZERS: 2, GRILL: 3, PASTRY: 4, HOT_APPETIZERS: 5,
  BEER_SNACKS: 6, DESSERT: 7, LAMB_DISHES: 8, BEEF_DISHES: 9, CHICKEN_DISHES: 10,
  SIDE_DISHES: 11, PASTA: 12, SOFT_DRINKS: 13, STEAKS: 14, ENERGY_DRINKS: 15,
  SALADS_OIL: 16, SALADS_MAYO: 17, COFFEE: 18, SUSHI_ROLLS: 19,
  DRIED_FRUITS: 20, CANDIES: 21,
  FIRST_COURSE: 22, SECOND_COURSE: 23, THIRD_COURSE: 24, SWEETS: 26, FRUITS: 27,
  ALCOHOL: 28, LEMONADES: 29, NON_ALCOHOLIC_COCKTAILS: 30, ALCOHOLIC_COCKTAILS: 31,
  MILKSHAKES: 32, TEA_MENU: 33, FRESH_JUICES: 34, LIQUEURS: 35,
};

function quickSort(items: MenuItem[]): MenuItem[] {
  if (items.length <= 1) return items;
  const pivot = items[Math.floor(items.length / 2)];
  const left: MenuItem[] = [], equal: MenuItem[] = [], right: MenuItem[] = [];
  for (const item of items) {
    const cmp =
      (CATEGORY_ORDER[item.category] ?? 99) - (CATEGORY_ORDER[pivot.category] ?? 99) ||
      item.name.localeCompare(pivot.name);
    if (cmp < 0) left.push(item);
    else if (cmp > 0) right.push(item);
    else equal.push(item);
  }
  return [...quickSort(left), ...equal, ...quickSort(right)];
}

const ADDITIONAL_CATEGORIES: MenuCategory[] = [
  'SOUPS', 'PIZZA', 'COLD_APPETIZERS', 'GRILL', 'PASTRY', 'HOT_APPETIZERS',
  'BEER_SNACKS', 'DESSERT', 'LAMB_DISHES', 'BEEF_DISHES', 'CHICKEN_DISHES',
  'SIDE_DISHES', 'PASTA', 'SOFT_DRINKS', 'STEAKS', 'ENERGY_DRINKS',
  'SALADS_OIL', 'SALADS_MAYO', 'COFFEE', 'SUSHI_ROLLS', 'DRIED_FRUITS', 'CANDIES',
  'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE', 'SWEETS', 'FRUITS',
  'ALCOHOL', 'LEMONADES', 'NON_ALCOHOLIC_COCKTAILS', 'ALCOHOLIC_COCKTAILS',
  'MILKSHAKES', 'TEA_MENU', 'FRESH_JUICES', 'LIQUEURS',
];

// Course categories are guest-selected (hot appetizers + first/second/third);
// the remaining package categories are the fixed "complimentary" included dishes.
const COURSE_CATEGORIES: MenuCategory[] = ['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'];

// Float best-seller dishes to the front of their list while keeping the relative
// order of everything else (a stable partition). Used so bestsellers show at the
// top of their category on the tablet set-menu screens.
function bestsellerFirst<T extends { menuItem: { isBestseller?: boolean } }>(items: T[]): T[] {
  const best: T[] = [], rest: T[] = [];
  for (const it of items) (it.menuItem.isBestseller ? best : rest).push(it);
  return [...best, ...rest];
}

// Small gold "Best seller" ribbon overlaid on a dish photo/card corner.
function BestsellerBadge({ t }: { t: TFn }) {
  return (
    <span style={{
      position: 'absolute', top: 6, left: 6, zIndex: 2,
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
      letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1,
      color: 'var(--rg-bg)', background: 'linear-gradient(135deg, var(--rg-accent-soft) 0%, var(--rg-accent) 100%)',
      boxShadow: '0 3px 10px rgba(var(--rg-accent-rgb),0.5)',
    }}>★ {t('bestseller')}</span>
  );
}

/** A table category's rate, set beside its name wherever the name is shown.
 *
 *  A table category is a price package, so its name on its own is half the
 *  answer. `textTransform: none` because it rides inside `.rg-label`, which is
 *  uppercase — a price in small caps reads as a part number. */
function TablePrice({ category, t }: { category: TableCategory; t: TFn }) {
  return (
    <span style={{ marginLeft: 8, color: 'var(--rg-accent)', textTransform: 'none', letterSpacing: 0 }}>
      {tableCategoryPrice(category, t('person'))}
    </span>
  );
}

/** One of the three settings at the top of the kiosk, drawn in one of two
 *  states: answered, or still waiting.
 *
 *  The waiting state is a dashed accent frame rather than an error colour —
 *  nothing is wrong, the guest simply has not got there yet. The whole thing is
 *  a `<label>` wrapping its control, so the caption is also the control's hit
 *  area and its accessible name; the three fields previously had neither. */
function PickField({ label, answered, children }: {
  label: string;
  answered: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`rg-pick block ${answered ? 'is-set' : 'is-empty'}`}>
      <span className="rg-label rg-pick-caption">
        {/* The badge is present in BOTH states — an empty ring that fills in —
            so the pair reads as one control with two settings rather than as a
            decoration that sometimes appears. */}
        <span className="rg-pick-mark" aria-hidden="true">{answered ? '✓' : ''}</span>
        {label}
      </span>
      {children}
    </label>
  );
}

// ── Decorative background ─────────────────────────────────────────────────

function PageBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div style={{
        position: 'absolute', top: '-140px', right: '-140px',
        width: '560px', height: '560px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--rg-accent-rgb),0.22) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-120px', left: '-120px',
        width: '520px', height: '520px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(60,110,50,0.35) 0%, transparent 65%)',
        filter: 'blur(50px)',
      }} />
      <div style={{
        position: 'absolute', top: '50%', right: '15%',
        width: '300px', height: '300px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--rg-accent-rgb),0.07) 0%, transparent 70%)',
        filter: 'blur(30px)',
      }} />
    </div>
  );
}

// ── TableCategoryFullscreen ───────────────────────────────────────────────

function TableCategoryFullscreen({
  tableCategories, onSelect, onBack, onLightbox, locale, setLocale, t,
}: {
  tableCategories: TableCategory[];
  onSelect: (id: string) => void;
  // Leave the chooser entirely. It is a full-screen overlay above the menu page,
  // so the page's own "← events" button is behind it and unreachable: without
  // this, picking a table was the ONLY way out of the tablet.
  onBack: () => void;
  onLightbox: (src: string) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  // The guest first picks a banquet event type; only its tables then appear.
  const [eventType, setEventType] = useState<TableEventType | null>(null);

  // Only two banquet event types remain: Nahor and Events (Tantana). Legacy
  // FOTIHA/TUI categories collapse into OTHERS ("Events").
  const EVENT_TYPE_ORDER: TableEventType[] = ['NAHOR', 'OTHERS'];
  const EVENT_TYPE_LABEL: Record<TableEventType, Parameters<typeof translate>[0]> = {
    NAHOR: 'dept_nahor', FOTIHA: 'table_event_events', TUI: 'table_event_events', OTHERS: 'table_event_events',
  };
  const catEventType = (tc: TableCategory): TableEventType => (tc.eventType === 'NAHOR' ? 'NAHOR' : 'OTHERS');
  const availableTypes = EVENT_TYPE_ORDER.filter((et) => tableCategories.some((tc) => catEventType(tc) === et));
  // Only gate behind an event-type choice when the tables span more than one type.
  const gated = availableTypes.length > 1;
  const shown = gated && eventType ? tableCategories.filter((tc) => catEventType(tc) === eventType) : tableCategories;

  const pickEventType = (et: TableEventType) => { setEventType(et); setCurrentIdx(0); };

  // When several table categories share the same price, guests need to see how
  // they differ. For each price bracket, compute the menu-item ids COMMON to
  // every category in it; anything not common is what makes a given category
  // distinctive, so we flag those ids to highlight them on each slide.
  const { distinctiveByCat, samePriceCountByCat } = (() => {
    const priceGroups = new Map<number, TableCategory[]>();
    for (const tc of shown) {
      const arr = priceGroups.get(tc.ratePerPerson) ?? [];
      arr.push(tc);
      priceGroups.set(tc.ratePerPerson, arr);
    }
    const distinctive = new Map<string, Set<string>>();
    const counts = new Map<string, number>();
    for (const group of priceGroups.values()) {
      for (const tc of group) counts.set(tc.id, group.length);
      if (group.length < 2) continue;
      const idSets = group.map((g) => new Set((g.packageItems ?? []).map((pi) => pi.menuItem.id)));
      const common = new Set([...idSets[0]].filter((id) => idSets.every((s) => s.has(id))));
      for (const g of group) {
        const own = (g.packageItems ?? []).map((pi) => pi.menuItem.id).filter((id) => !common.has(id));
        distinctive.set(g.id, new Set(own));
      }
    }
    return { distinctiveByCat: distinctive, samePriceCountByCat: counts };
  })();

  const goTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== currentIdx) setCurrentIdx(idx);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      background: 'linear-gradient(135deg, var(--rg-bg) 0%, var(--rg-bg-dark) 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {/* One Back button, always present, that undoes the last step: from the
              table list back to the event types, and from the first step out of
              the chooser altogether. It used to appear only on the second step of
              a gated chooser, so on a restaurant with a single event type there
              was no way back at all. */}
          <button type="button"
            onClick={() => { if (gated && eventType) setEventType(null); else onBack(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
              color: 'var(--rg-accent)', background: 'rgba(var(--rg-accent-rgb),0.12)',
              border: '1px solid rgba(var(--rg-accent-rgb),0.4)',
            }}>
            ‹ {gated && eventType ? t(EVENT_TYPE_LABEL[eventType]) : t('back')}
          </button>
          <p style={{
            margin: 0, color: 'rgba(255,255,255,0.55)',
            fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
          }}>
            {gated && !eventType ? t('choose_event_type') : t('choose_table_category')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: locale === loc ? 'rgba(var(--rg-accent-rgb),0.6)' : 'rgba(255,255,255,0.15)',
                background: locale === loc ? 'rgba(var(--rg-accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                color: locale === loc ? 'var(--rg-accent)' : 'rgba(255,255,255,0.7)',
                fontWeight: locale === loc ? 700 : 500,
                fontSize: 11,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {gated && !eventType ? (
        /* Event-type chooser — shown before any table categories appear. */
        <div className="scrollbar-none" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 20px' }}>
          <div style={{ width: '100%', maxWidth: 760, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))' }}>
            {availableTypes.map((et) => {
              const count = tableCategories.filter((tc) => catEventType(tc) === et).length;
              return (
                <button key={et} type="button" onClick={() => pickEventType(et)}
                  className="tablet-fade-up"
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                    padding: '26px 24px', borderRadius: 20, cursor: 'pointer', textAlign: 'left',
                    background: 'linear-gradient(160deg, rgba(var(--rg-accent-rgb),0.14), rgba(255,255,255,0.03))',
                    border: '1px solid rgba(var(--rg-accent-rgb),0.4)',
                    color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                  }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--rg-accent)', letterSpacing: '-0.01em' }}>
                    {t(EVENT_TYPE_LABEL[et])}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('tables_available', { count })}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      <>
      {/* Slides */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-none"
        style={{
          flex: 1, minHeight: 0,
          display: 'flex',
          overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {shown.map((tc, i) => (
          <CategorySlide
            key={tc.id}
            tc={tc}
            index={i + 1}
            total={shown.length}
            onSelect={() => onSelect(tc.id)}
            onLightbox={onLightbox}
            locale={locale}
            t={t}
            distinctiveItemIds={distinctiveByCat.get(tc.id)}
            samePriceCount={samePriceCountByCat.get(tc.id) ?? 1}
          />
        ))}
      </div>

      {/* Bottom: arrows + dots */}
      <div style={{
        padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(12px)',
      }}>
        <button
          type="button"
          onClick={() => goTo(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
            background: 'rgba(var(--rg-accent-rgb),0.1)',
            color: 'var(--rg-accent)', fontSize: 22, fontWeight: 700, lineHeight: 1,
            cursor: currentIdx === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIdx === 0 ? 0.35 : 1,
            transition: 'opacity 0.2s',
          }}
          aria-label="Previous"
        >‹</button>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {shown.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              style={{
                width: i === currentIdx ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === currentIdx ? 'var(--rg-accent)' : 'rgba(255,255,255,0.25)',
                border: 'none',
                cursor: 'pointer',
                transition: 'width 0.25s, background 0.25s',
                padding: 0,
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(Math.min(shown.length - 1, currentIdx + 1))}
          disabled={currentIdx === shown.length - 1}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
            background: 'rgba(var(--rg-accent-rgb),0.1)',
            color: 'var(--rg-accent)', fontSize: 22, fontWeight: 700, lineHeight: 1,
            cursor: currentIdx === shown.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIdx === shown.length - 1 ? 0.35 : 1,
            transition: 'opacity 0.2s',
          }}
          aria-label="Next"
        >›</button>
      </div>
      </>
      )}
    </div>
  );
}

function CategorySlide({
  tc, index, total, onSelect, onLightbox, locale, t, distinctiveItemIds, samePriceCount,
}: {
  tc: TableCategory;
  index: number;
  total: number;
  onSelect: () => void;
  onLightbox: (src: string) => void;
  locale: Locale;
  t: TFn;
  distinctiveItemIds?: Set<string>;
  samePriceCount: number;
}) {
  const photos = (tc.photos ?? []).filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);
  // The included-dishes list is hidden until the guest taps to reveal it.
  const [showDishes, setShowDishes] = useState(false);
  const photoScrollRef = useRef<HTMLDivElement>(null);

  const includedCats = tc.includedCategories
    ? tc.includedCategories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  // The actual included dishes, grouped by their menu category (in first-seen
  // order). When categories share a price, distinctive dishes are highlighted.
  const dishGroups: { category: string; items: TableCategoryPackageItem[] }[] = [];
  const groupByCat = new Map<string, { category: string; items: TableCategoryPackageItem[] }>();
  for (const pi of tc.packageItems ?? []) {
    let g = groupByCat.get(pi.menuItem.category);
    if (!g) {
      g = { category: pi.menuItem.category, items: [] };
      groupByCat.set(pi.menuItem.category, g);
      dishGroups.push(g);
    }
    g.items.push(pi);
  }
  // Float best sellers to the top of each category.
  for (const g of dishGroups) g.items = bestsellerFirst(g.items);
  const sharedPrice = samePriceCount > 1;
  const hasDistinctive = !!distinctiveItemIds && distinctiveItemIds.size > 0;

  const goToPhoto = (idx: number) => {
    const el = photoScrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(photos.length - 1, idx));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };
  const handlePhotoScroll = () => {
    const el = photoScrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== photoIdx) setPhotoIdx(idx);
  };

  const photoPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToPhoto(photoIdx - 1);
  };
  const photoNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToPhoto(photoIdx + 1);
  };

  return (
    <div style={{
      flex: '0 0 100%',
      scrollSnapAlign: 'center',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      padding: '24px 20px 20px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 720,
        display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center',
      }}>

        {/* Slide index */}
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 700,
          color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em',
        }}>
          {index} / {total}
        </p>

        {/* Photo */}
        <div style={{
          position: 'relative', width: '100%',
          aspectRatio: '16 / 10', maxHeight: '42vh',
          borderRadius: 24, overflow: 'hidden',
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 14px 40px rgba(0,0,0,0.45)',
        }}>
          {photos.length > 0 ? (
            <>
              {/* Horizontal swipe carousel — one image per snap point. */}
              <div
                ref={photoScrollRef}
                onScroll={handlePhotoScroll}
                className="scrollbar-none"
                style={{
                  display: 'flex', width: '100%', height: '100%',
                  overflowX: 'auto', overflowY: 'hidden',
                  scrollSnapType: 'x mandatory',
                  overscrollBehaviorX: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {photos.map((p, i) => (
                  <button key={i} type="button"
                    onClick={() => onLightbox(getPhotoUrl(p) ?? '')}
                    style={{ flex: '0 0 100%', scrollSnapAlign: 'center', display: 'block', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'zoom-in' }}>
                    <img src={getPhotoUrl(p)} alt={tc.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={photoPrev}
                    style={{
                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                      border: 'none', color: '#fff', fontSize: 20, lineHeight: 1, cursor: 'pointer',
                    }}>‹</button>
                  <button type="button" onClick={photoNext}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                      border: 'none', color: '#fff', fontSize: 20, lineHeight: 1, cursor: 'pointer',
                    }}>›</button>
                  <div style={{
                    position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', gap: 6,
                  }}>
                    {photos.map((_, i) => (
                      <span key={i} style={{
                        width: i === photoIdx ? 18 : 6, height: 6, borderRadius: 3,
                        background: 'rgba(255,255,255,0.85)',
                        opacity: i === photoIdx ? 1 : 0.5,
                        transition: 'width 0.2s, opacity 0.2s',
                      }} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Name + Price */}
        <div style={{ textAlign: 'center' }}>
          <h2 className="rg-display" style={{
            margin: 0, fontSize: 28, color: '#fff', letterSpacing: '-0.01em',
          }}>{tc.name}</h2>
          <p style={{
            margin: '8px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--rg-accent)',
          }}>
            {formatSum(tc.ratePerPerson)}
            <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.55)', marginLeft: 6 }}>
              / {t('person')}
            </span>
          </p>
        </div>

        {/* Select button — moved up, just under the price, and made compact. */}
        <button type="button" onClick={onSelect}
          style={{
            padding: '11px 34px', borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, var(--rg-accent) 0%, var(--rg-accent-soft) 100%)',
            color: 'var(--rg-bg)', fontSize: 15, fontWeight: 700, letterSpacing: '0.02em',
            cursor: 'pointer', boxShadow: '0 6px 18px rgba(var(--rg-accent-rgb),0.35)',
          }}>
          {t('select_table')} →
        </button>

        {/* Description */}
        {tc.description && (
          <p style={{
            margin: 0, textAlign: 'center', maxWidth: 520,
            fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)',
          }}>{tc.description}</p>
        )}

        {/* Included dishes — hidden until the guest taps the button. Grouped by
            category; when several tables share this price, the dishes that make
            this one different are highlighted. */}
        {(dishGroups.length > 0 || includedCats.length > 0) && (
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <button type="button" onClick={() => setShowDishes((v) => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.16)',
              }}>
              {t('included_dishes')}
              {sharedPrice && hasDistinctive && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                  color: 'var(--rg-bg)', background: 'var(--rg-accent)',
                }}>
                  ★ {t('differences_highlighted')}
                </span>
              )}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                style={{ transform: showDishes ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}

        {/* The revealed list (dishes when available, otherwise category chips). */}
        {showDishes && dishGroups.length > 0 && (
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {dishGroups.map((g) => (
              <div key={g.category}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(var(--rg-accent-rgb),0.75)' }}>
                  {t(g.category.toLowerCase() as Parameters<typeof translate>[0])}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {g.items.map((pi) => {
                    const distinct = sharedPrice && !!distinctiveItemIds?.has(pi.menuItem.id);
                    const best = !!pi.menuItem.isBestseller;
                    const highlight = distinct || best;
                    const photoSrc = pi.menuItem.photoUrl ? getPhotoUrl(pi.menuItem.photoUrl) : null;
                    const chipStyle: React.CSSProperties = {
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: highlight ? 700 : 500,
                      background: highlight ? 'rgba(var(--rg-accent-rgb),0.22)' : 'rgba(255,255,255,0.06)',
                      color: highlight ? 'var(--rg-accent)' : 'rgba(255,255,255,0.8)',
                      border: `1px solid ${highlight ? 'var(--rg-accent)' : 'rgba(255,255,255,0.12)'}`,
                      boxShadow: highlight ? '0 2px 12px rgba(var(--rg-accent-rgb),0.25)' : 'none',
                    };
                    const label = (
                      <>
                        {best && <span style={{ fontSize: 11 }}>★</span>}
                        {distinct && !best && <span style={{ fontSize: 11 }}>★</span>}
                        {dishName(pi.menuItem, locale)}
                        {photoSrc && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.65 }}>
                            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                          </svg>
                        )}
                      </>
                    );
                    // Tapping a dish with a photo opens it full-screen.
                    return photoSrc ? (
                      <button key={pi.id} type="button" title={t('view_photo')}
                        onClick={() => onLightbox(photoSrc)}
                        style={{ ...chipStyle, cursor: 'zoom-in' }}>
                        {label}
                      </button>
                    ) : (
                      <span key={pi.id} style={chipStyle}>{label}</span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No dish detail configured — reveal the included category chips instead. */}
        {showDishes && dishGroups.length === 0 && includedCats.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {includedCats.map((cat) => (
              <span key={cat} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: 'rgba(var(--rg-accent-rgb),0.15)', color: 'var(--rg-accent)',
                border: '1px solid rgba(var(--rg-accent-rgb),0.3)',
              }}>
                {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One option in a course list: a dish the package includes, or a paid dish of
 *  the same category offered beside it. The item type is the package item's —
 *  narrower than `MenuItem` — so both kinds fit one list. */
type CourseOption = { item: TableCategoryPackageItem['menuItem']; paid: boolean };

// ── Reusable: course choice (first/second/third) for a table category ─────
// Shared by the adult table and the optional children's table so both behave
// identically. `card` wraps the content in its own rg-card section.

function CourseChoiceSection({
  tableCategory, t, locale, onLightbox, card = false, showName = true, hotAppetizerMax = 3,
  hotAppetizerSelectedIds, firstSelectedId, secondSelectedIds, thirdSelectedIds,
  onToggleHotAppetizer, onFirst, onToggleSecond, onToggleThird,
  paidOptions = [], paidSelectedIds = [], onTogglePaid,
}: {
  tableCategory: TableCategory;
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
  card?: boolean;
  showName?: boolean;
  hotAppetizerMax?: number;
  hotAppetizerSelectedIds: string[];
  firstSelectedId?: string;
  secondSelectedIds: string[];
  thirdSelectedIds: string[];
  onToggleHotAppetizer: (id: string) => void;
  onFirst: (id: string) => void;
  onToggleSecond: (id: string) => void;
  onToggleThird: (id: string) => void;
  // Paid dishes from the SAME course categories, shown beside the complimentary
  // ones so a guest sees the upgrade while they are choosing rather than having
  // to find it in the Additional section further down. Optional: the children's
  // table passes none — a paid adult extra is not a children's course.
  paidOptions?: MenuItem[];
  paidSelectedIds?: string[];
  onTogglePaid?: (id: string) => void;
}) {
  // Hot appetizers come first — multi-select, up to three. The three courses that
  // follow are each single-select (exactly one dish).
  const courseGroups = [
    { category: 'HOT_APPETIZERS' as const, labelKey: 'choose_hot_appetizers' as const, changeKey: 'change_hot_appetizers' as const,
      multi: true, isSelected: (id: string) => hotAppetizerSelectedIds.includes(id), onToggle: onToggleHotAppetizer },
    { category: 'FIRST_COURSE' as const, labelKey: 'choose_first_course' as const, changeKey: 'change_first_course' as const,
      multi: false, isSelected: (id: string) => firstSelectedId === id, onToggle: onFirst },
    { category: 'SECOND_COURSE' as const, labelKey: 'choose_second_course' as const, changeKey: 'change_second_course' as const,
      multi: false, isSelected: (id: string) => secondSelectedIds.includes(id), onToggle: onToggleSecond },
    { category: 'THIRD_COURSE' as const, labelKey: 'choose_third_course' as const, changeKey: 'change_third_course' as const,
      multi: false, isSelected: (id: string) => thirdSelectedIds.includes(id), onToggle: onToggleThird },
  ]
    .map((cfg) => {
      // Two kinds of option in one grid: what the package includes, and what the
      // guest can pay to add. `paid` decides the price line, the control shape
      // and which handler runs — a paid dish is an addition, so choosing one
      // never replaces the free course the guest also picked.
      const free: CourseOption[] = bestsellerFirst(
        (tableCategory.packageItems ?? []).filter((pi) => pi.menuItem.category === cfg.category),
      ).map((pi) => ({ item: pi.menuItem, paid: false }));
      const includedIds = new Set(free.map((o) => o.item.id));
      const paid: CourseOption[] = bestsellerFirst(
        paidOptions
          .filter((m) => m.category === cfg.category && !includedIds.has(m.id))
          .map((menuItem) => ({ menuItem })),
      ).map(({ menuItem }) => ({ item: menuItem, paid: true }));
      return { ...cfg, free, options: [...free, ...paid] };
    })
    .filter((group) => group.options.length > 0);
  if (courseGroups.length === 0) return null;

  // Each course is single-select: once chosen, collapse its list to just the
  // picked dish and offer a button to expand it again to change the choice.
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  const inner = (
    <>
      <div className="mb-6" style={{ textAlign: 'center' }}>
        {showName && (
          <p className="rg-label">
            {tableCategory.name}
            <TablePrice category={tableCategory} t={t} />
          </p>
        )}
        <h2 className="rg-display rg-shine" style={{
          margin: '6px 0 0', fontSize: 28,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          backgroundImage: 'linear-gradient(135deg, var(--rg-accent-soft) 0%, var(--rg-accent) 60%, var(--rg-accent-deep) 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text',
          WebkitTextFillColor: 'transparent', color: 'var(--rg-accent)',
          textShadow: '0 2px 18px rgba(var(--rg-accent-rgb),0.25)',
        }}>{t('courses')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ height: 1, width: 64, background: 'linear-gradient(90deg, transparent, rgba(var(--rg-accent-rgb),0.7))' }} />
          <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: 'var(--rg-accent)', boxShadow: '0 0 10px rgba(var(--rg-accent-rgb),0.85)' }} />
          <span style={{ height: 1, width: 64, background: 'linear-gradient(90deg, rgba(var(--rg-accent-rgb),0.7), transparent)' }} />
        </div>
      </div>

      {courseGroups.map((group, gi) => {
        const isChosen = (o: CourseOption) =>
          o.paid ? paidSelectedIds.includes(o.item.id) : group.isSelected(o.item.id);
        // "Full" is about the FREE course only — a paid addition is not one of
        // the picks the package allows, so buying one must not collapse the list
        // as though the guest had chosen.
        const selectedCount = group.free.filter((o) => group.isSelected(o.item.id)).length;
        // Single-select courses collapse once their one dish is chosen; the
        // multi-select hot appetizers only collapse after every allowed pick is made.
        const full = group.multi ? selectedCount >= hotAppetizerMax : selectedCount >= 1;
        const collapsed = full && !expandedCats[group.category];
        // Collapsed, the list keeps everything chosen — including a paid dish,
        // which would otherwise look as though it had been dropped.
        const displayItems = collapsed ? group.options.filter(isChosen) : group.options;
        return (
        <div key={group.category} className={gi < courseGroups.length - 1 ? 'mb-8' : ''}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundImage: 'linear-gradient(135deg, var(--rg-accent-soft) 0%, var(--rg-accent) 100%)',
              color: 'var(--rg-bg)', fontWeight: 800, fontSize: 20,
              boxShadow: '0 6px 18px rgba(var(--rg-accent-rgb),0.45)',
              border: '2px solid rgba(255,255,255,0.3)',
            }}>{gi + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                {t(group.labelKey)}
              </h3>
              {group.multi && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6,
                  padding: '3px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.03em',
                  color: 'var(--rg-accent-soft)', background: 'rgba(var(--rg-accent-rgb),0.14)', border: '1px solid rgba(var(--rg-accent-rgb),0.34)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="var(--rg-accent-soft)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('up_to_n', { count: hotAppetizerMax })}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
            {displayItems.map((option, i) => {
              const item = option.item;
              const selected = isChosen(option);
              const photoSrc = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
              // A paid dish is added, not chosen instead of something, so it
              // always gets the checkbox shape even inside a single-select course.
              const checkbox = option.paid || group.multi;
              return (
                <div key={item.id}
                  className="tablet-fade-up"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    position: 'relative', borderRadius: 14, overflow: 'hidden',
                    height: '100%', display: 'flex', flexDirection: 'column',
                    outline: selected ? '2px solid var(--rg-accent)' : '1px solid rgba(255,255,255,0.12)',
                    outlineOffset: selected ? 2 : 0,
                    background: selected ? 'rgba(var(--rg-accent-rgb),0.12)' : 'rgba(255,255,255,0.06)',
                    transition: 'outline 0.18s, background 0.18s',
                  }}>
                  {item.isBestseller && <BestsellerBadge t={t} />}
                  {photoSrc ? (
                    <button type="button"
                      onClick={() => onLightbox(photoSrc)}
                      style={{ display: 'block', width: '100%', border: 'none', padding: 0, cursor: 'zoom-in', background: 'transparent', position: 'relative' }}>
                      <img src={photoSrc} alt={item.name}
                        style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                    </button>
                  ) : (
                    <div style={{ height: 120, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="30" height="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => {
                      if (option.paid) { onTogglePaid?.(item.id); return; }
                      group.onToggle(item.id);
                      if (!group.multi) setExpandedCats((e) => ({ ...e, [group.category]: false }));
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto',
                      width: '100%', padding: '8px 10px',
                      border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{
                      flexShrink: 0,
                      width: 20, height: 20, borderRadius: checkbox ? 6 : '50%',
                      border: `2px solid ${selected ? 'var(--rg-accent)' : 'rgba(255,255,255,0.3)'}`,
                      background: selected ? 'var(--rg-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {selected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="var(--rg-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: selected ? 'var(--rg-accent)' : '#fff', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dishName(item, locale)}</p>
                      {/* The price is the whole difference between the two kinds
                          of option, so it is stated rather than implied — an
                          included dish carries no price line at all. */}
                      {option.paid && (
                        <p style={{ margin: '2px 0 0', fontSize: 12.5, fontWeight: 700, color: 'var(--rg-accent)', lineHeight: 1.2 }}>
                          + {formatSum(item.priceCents)}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Once the picks are complete, collapse the options; button re-expands. */}
          {(full || expandedCats[group.category]) && group.options.length > 1 && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button type="button"
                onClick={() => setExpandedCats((e) => ({ ...e, [group.category]: !e[group.category] }))}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 18px', borderRadius: 999, cursor: 'pointer',
                  fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                  color: 'var(--rg-accent)', background: 'rgba(var(--rg-accent-rgb),0.1)',
                  border: '1px solid rgba(var(--rg-accent-rgb),0.4)',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
                  style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {collapsed ? t(group.changeKey) : t('collapse_options')}
              </button>
            </div>
          )}
        </div>
        );
      })}
    </>
  );

  return card ? <section className="rg-card p-4 sm:p-6 reveal">{inner}</section> : <>{inner}</>;
}

// ── Dish picker modal: pick a free replacement, shown with photo + description ──
// Opened by the "Edit" button on an included dish. The first option is the
// dish included by default (selecting it clears the swap); the rest are the
// free alternatives in the same category.

function DishSwapModal({
  pi, alternatives, chosenId, locale, t, onChoose, onClose,
}: {
  pi: TableCategoryPackageItem;
  alternatives: MenuItem[];
  chosenId?: string;
  locale: Locale;
  t: TFn;
  onChoose: (menuItemId: string | null) => void;
  onClose: () => void;
}) {
  // Only the free-swap options are shown — never the included/default dish. The
  // guest picks any available option for this position; clicking the currently
  // selected one again reverts the position back to its default dish.
  const currentValue = chosenId ?? null;
  const themeAccent = usePublicDataStore((s) => s.tabletAccentColor);
  const themeBg = usePublicDataStore((s) => s.tabletBgColor);

  // Rendered through a portal to <body>: the swap picker lives inside a .rg-card
  // whose backdrop-filter establishes a containing block, which would otherwise
  // clip this position:fixed overlay to the card instead of the full viewport.
  // The portal escapes the themed <main>, so re-apply the restaurant theme vars.
  return createPortal(
    <div onClick={onClose}
      style={{
        ...tabletThemeVars({ accent: themeAccent, bg: themeBg }),
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(6,14,9,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      } as React.CSSProperties}>
      <div onClick={(e) => e.stopPropagation()} className="tablet-fade-up"
        style={{
          width: '100%', maxWidth: 760, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(var(--rg-bg-rgb),0.98) 0%, rgba(var(--rg-bg-dark-rgb),0.98) 100%)',
          border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
        }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ minWidth: 0 }}>
            <p className="rg-label" style={{ margin: 0 }}>{dishName(pi.menuItem, locale)}</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#fff' }}>{t('choose_replacement')}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('cancel')}
            style={{
              flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)',
              color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer',
            }}>×</button>
        </div>

        {/* Options grid */}
        <div className="scrollbar-none"
          style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))' }}>
          {alternatives.map((item) => {
            const selected = currentValue === item.id;
            const photoSrc = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
            return (
              // Clicking the selected option again reverts to the default dish.
              <button key={item.id} type="button" onClick={() => onChoose(selected ? null : item.id)}
                style={{
                  textAlign: 'left', padding: 0, cursor: 'pointer',
                  borderRadius: 16, overflow: 'hidden',
                  background: selected ? 'rgba(var(--rg-accent-rgb),0.14)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${selected ? 'var(--rg-accent)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'border 0.18s, background 0.18s',
                }}>
                {photoSrc ? (
                  <img src={photoSrc} alt={dishName(item, locale)}
                    style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 150, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="34" height="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: selected ? 'var(--rg-accent)' : '#fff', lineHeight: 1.25 }}>
                      {dishName(item, locale)}
                    </p>
                    {selected && (
                      <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--rg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="var(--rg-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Revert — only when this position is currently swapped. */}
        {currentValue != null && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <button type="button" onClick={() => onChoose(null)}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: 'var(--rg-accent-soft)',
                background: 'rgba(var(--rg-accent-rgb),0.1)', border: '1px solid rgba(var(--rg-accent-rgb),0.3)',
              }}>
              ↺ {t('revert_to_default')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Extras: pick which included complimentary dish this paid dish replaces ─────
// Opened from the "Replace an included dish" button on an Extra. Lists the set
// menu's included dishes in the SAME category; choosing one makes the paid dish
// stand in for it (served free) rather than being charged as an addition.

function ExtraReplaceModal({
  extra, candidates, replacements, menuItems, locale, t, onChoose, onClose,
}: {
  extra: MenuItem;
  candidates: TableCategoryPackageItem[];
  replacements: Record<string, string>;
  menuItems: MenuItem[];
  locale: Locale;
  t: TFn;
  onChoose: (packageItemId: string) => void;
  onClose: () => void;
}) {
  const themeAccent = usePublicDataStore((s) => s.tabletAccentColor);
  const themeBg = usePublicDataStore((s) => s.tabletBgColor);

  return createPortal(
    <div onClick={onClose}
      style={{
        ...tabletThemeVars({ accent: themeAccent, bg: themeBg }),
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(6,14,9,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      } as React.CSSProperties}>
      <div onClick={(e) => e.stopPropagation()} className="tablet-fade-up"
        style={{
          width: '100%', maxWidth: 760, maxHeight: '88vh',
          display: 'flex', flexDirection: 'column', borderRadius: 24,
          background: 'linear-gradient(135deg, rgba(var(--rg-bg-rgb),0.98) 0%, rgba(var(--rg-bg-dark-rgb),0.98) 100%)',
          border: '1px solid rgba(var(--rg-accent-rgb),0.35)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ minWidth: 0 }}>
            <p className="rg-label" style={{ margin: 0 }}>{dishName(extra, locale)}</p>
            <h3 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#fff' }}>{t('choose_dish_to_replace')}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('cancel')}
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
        </div>

        <div className="scrollbar-none"
          style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))' }}>
          {candidates.map((pi) => {
            // The dish currently occupying this slot (default, or an earlier swap).
            const swapId = replacements[pi.id];
            const current = swapId ? (menuItems.find((m) => m.id === swapId) ?? pi.menuItem) : pi.menuItem;
            const selected = swapId === extra.id;
            const photoSrc = current.photoUrl ? getPhotoUrl(current.photoUrl) : null;
            return (
              <button key={pi.id} type="button" onClick={() => onChoose(pi.id)}
                style={{
                  textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 16, overflow: 'hidden',
                  background: selected ? 'rgba(var(--rg-accent-rgb),0.14)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${selected ? 'var(--rg-accent)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'border 0.18s, background 0.18s',
                }}>
                {photoSrc ? (
                  <img src={photoSrc} alt={dishName(current, locale)} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 150, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="34" height="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div style={{ padding: '10px 12px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 15, fontWeight: 700, color: selected ? 'var(--rg-accent)' : '#fff', lineHeight: 1.25 }}>
                    {dishName(current, locale)}
                  </p>
                  {selected && (
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'var(--rg-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="var(--rg-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Reusable: included dishes (non-course categories) with free swaps ──────

function IncludedDishesSection({
  tableCategory, menuItems, t, locale, onLightbox, card = false, showName = true,
  replacements, onReplacement,
}: {
  tableCategory: TableCategory;
  menuItems: MenuItem[];
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
  card?: boolean;
  showName?: boolean;
  replacements: Record<string, string>;
  onReplacement: (packageItemId: string, menuItemId: string | null) => void;
}) {
  const [editingPiId, setEditingPiId] = useState<string | null>(null);
  const includedItems = (tableCategory.packageItems ?? []).filter(
    (pi) => pi.menuItem.category !== 'HOT_APPETIZERS' &&
      pi.menuItem.category !== 'FIRST_COURSE' && pi.menuItem.category !== 'SECOND_COURSE' && pi.menuItem.category !== 'THIRD_COURSE'
  );
  if (includedItems.length === 0) return null;
  // Dishes already included in the package by default must never be offered as a
  // free swap for another slot (it's already on the table for free).
  const packageDefaultIds = new Set((tableCategory.packageItems ?? []).map((pi) => pi.menuItem.id));
  const grouped = Object.entries(
    includedItems.reduce<Record<string, typeof includedItems>>(
      (acc, pi) => { const cat = pi.menuItem.category; if (!acc[cat]) acc[cat] = []; acc[cat]!.push(pi); return acc; }, {}
    )
  ).sort(([a], [b]) => (CATEGORY_ORDER[a as MenuCategory] ?? 99) - (CATEGORY_ORDER[b as MenuCategory] ?? 99));

  // A dish is free to swap in for this table when the Additional page has it
  // marked Free — on its own or alongside Paid. "Paid only" is deliberately not
  // free, and "neither" is not offered at all: it is simply part of whichever
  // table packages include it. The table's own default dishes are filtered out
  // separately in getFreeAlts via packageDefaultIds.
  const isFreeForThisTable = (m: MenuItem) =>
    m.isActive !== false && isFreeChoice(tabletStatusOf(m));

  // Free alternatives for a package item: same category, allowed as a free swap
  // for this table, not already part of the package and not swapped-in elsewhere.
  const getFreeAlts = (pi: TableCategoryPackageItem) => {
    const usedByOthers = new Set(
      Object.entries(replacements).filter(([piId]) => piId !== pi.id).map(([, menuItemId]) => menuItemId)
    );
    return (menuItems ?? []).filter(
      (m) => m.category === pi.menuItem.category && isFreeForThisTable(m) &&
        !packageDefaultIds.has(m.id) && !usedByOthers.has(m.id)
    );
  };
  const editingPi = editingPiId ? includedItems.find((pi) => pi.id === editingPiId) ?? null : null;

  // Small categories (fewer than five dishes) are folded into one combined group
  // so the set menu doesn't fragment into many tiny sections; larger categories
  // keep their own full section. Within the combined group each small category is
  // still labelled and separated by a divider line.
  const SMALL_CATEGORY_THRESHOLD = 5;
  const bigGroups = grouped.filter(([, items]) => (items?.length ?? 0) >= SMALL_CATEGORY_THRESHOLD);
  const smallGroups = grouped.filter(([, items]) => (items?.length ?? 0) < SMALL_CATEGORY_THRESHOLD);

  const categoryHeader = (cat: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--rg-accent)', flexShrink: 0 }} />
      <span style={{
        display: 'inline-block', padding: '3px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: 'var(--rg-accent-soft)', background: 'rgba(var(--rg-accent-rgb),0.12)', border: '1px solid rgba(var(--rg-accent-rgb),0.28)',
      }}>
        {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
      </span>
    </div>
  );

  // A lighter label used for the small-category subdivisions inside the combined
  // "Assorted" category (minor, so the group still reads as one category).
  const minorHeader = (cat: string) => (
    <p style={{
      margin: '0 0 8px', fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
    }}>
      {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
    </p>
  );

  // One dish card. `fixedWidth` is used by the horizontal small-category row so
  // the cards keep a constant width and run consecutively on a single line.
  const dishCard = (pi: TableCategoryPackageItem, i: number, fixedWidth?: number) => {
        const freeAlts = getFreeAlts(pi);
        const chosenId = replacements[pi.id];
        const displayItem = chosenId ? ((menuItems ?? []).find((m) => m.id === chosenId) ?? pi.menuItem) : pi.menuItem;
        const isSwapped = displayItem.id !== pi.menuItem.id;
        return (
          <div key={pi.id}
            className="group flex flex-col overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg tablet-fade-up"
            style={{ position: 'relative', height: '100%', animationDelay: `${i * 50}ms`, background: 'rgba(255,255,255,0.06)', border: `1px solid ${isSwapped ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.12)'}`, ...(fixedWidth ? { width: fixedWidth, flexShrink: 0 } : {}) }}>
            {displayItem.isBestseller && <BestsellerBadge t={t} />}
            {displayItem.photoUrl ? (
              <button type="button"
                onClick={() => onLightbox(getPhotoUrl(displayItem.photoUrl) ?? null)}
                className="block w-full overflow-hidden">
                <img src={getPhotoUrl(displayItem.photoUrl)} alt={displayItem.name}
                  className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]" />
              </button>
            ) : (
              <div className="flex h-32 items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <svg className="h-8 w-8" style={{ color: 'rgba(255,255,255,0.15)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="flex flex-1 flex-col p-2.5">
              <p className="text-sm font-semibold leading-snug text-white">{dishName(displayItem, locale)}</p>
              {freeAlts.length > 0 && (
                <button type="button" onClick={() => setEditingPiId(pi.id)}
                  className="mt-auto pt-2.5"
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
                    color: isSwapped ? '#93c5fd' : 'var(--rg-accent-soft)',
                    background: isSwapped ? 'rgba(59,130,246,0.12)' : 'rgba(var(--rg-accent-rgb),0.1)',
                    border: `1px solid ${isSwapped ? 'rgba(59,130,246,0.45)' : 'rgba(var(--rg-accent-rgb),0.3)'}`,
                  }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t('edit')}
                </button>
              )}
            </div>
          </div>
        );
  };

  const dishGrid = (items: TableCategoryPackageItem[]) => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
      {bestsellerFirst(items).map((pi, i) => dishCard(pi, i))}
    </div>
  );

  const inner = (
    <>
      <div className="mb-5">
        {showName && (
          <p className="rg-label">
            {tableCategory.name}
            <TablePrice category={tableCategory} t={t} />
          </p>
        )}
        <p className="rg-heading mt-1">{t('included_with_table')}</p>
      </div>

      {/* Big categories: each keeps its own section */}
      {bigGroups.map(([cat, items], i) => (
        <div key={cat} style={{
          paddingTop: i > 0 ? 20 : 0,
          marginTop: i > 0 ? 20 : 0,
          borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}>
          {categoryHeader(cat)}
          {dishGrid(items!)}
        </div>
      ))}

      {/* Small categories (< 5 items) are merged into ONE "Assorted" category.
          Their dishes run consecutively on a single horizontal line; each small
          category keeps its name above its dishes and is separated from the next
          by a vertical divider. Scrolls sideways when too wide to fit. */}
      {smallGroups.length > 0 && (
        <div style={{
          paddingTop: bigGroups.length > 0 ? 20 : 0,
          marginTop: bigGroups.length > 0 ? 20 : 0,
          borderTop: bigGroups.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}>
          {categoryHeader('assorted')}
          {/* CSS Grid (not flex) so the dish-card row shares ONE track height across
              every mini-category column — flexbox only stretches children within
              their own row, so cards in different mini-categories would otherwise
              end up different heights depending on each category's tallest card. */}
          <div className="scrollbar-none" style={{
            display: 'grid', gridAutoFlow: 'column', gridTemplateRows: 'auto 1fr',
            columnGap: 0, overflowX: 'auto', alignItems: 'stretch',
          }}>
            {smallGroups.map(([cat, items], si) => {
              const divider = si > 0 ? { paddingLeft: 16, marginLeft: 16, borderLeft: '1px solid rgba(var(--rg-accent-rgb),0.3)' } : {};
              return (
                <div key={cat} style={{ display: 'contents' }}>
                  <div style={{ ...divider }}>{minorHeader(cat)}</div>
                  <div style={{ ...divider, display: 'flex', gap: 12, height: '100%' }}>
                    {bestsellerFirst(items!).map((pi, i) => dishCard(pi, i, 150))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editingPi && (
        <DishSwapModal
          pi={editingPi}
          alternatives={getFreeAlts(editingPi)}
          chosenId={replacements[editingPi.id]}
          locale={locale}
          t={t}
          onChoose={(menuItemId) => { onReplacement(editingPi.id, menuItemId); setEditingPiId(null); }}
          onClose={() => setEditingPiId(null)}
        />
      )}
    </>
  );

  return card ? <section className="rg-card p-4 sm:p-6 reveal">{inner}</section> : <>{inner}</>;
}

// ── Optional children's table: toggle + count + full course/dish selection ──

function ChildrenTableSection({
  tableCategory, menuItems, t, locale, onLightbox,
}: {
  tableCategory: TableCategory;
  menuItems: MenuItem[];
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
}) {
  const {
    childrenTableSelected, childrenCount,
    childHotAppetizerIds, childFirstCourseId, childSecondCourseIds, childThirdCourseIds, childReplacements,
    setChildrenTableSelected, setChildrenCount,
    toggleChildHotAppetizer, setChildFirstCourse, toggleChildSecondCourse, toggleChildThirdCourse, setChildReplacement,
  } = useTabletStore();

  return (
    <section className="rg-card p-4 sm:p-6 reveal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <span style={{
            display: 'inline-block', marginBottom: 6, padding: '3px 12px', borderRadius: 999,
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#f9a8d4', background: 'rgba(236,72,153,0.14)', border: '1px solid rgba(236,72,153,0.4)',
          }}>{t('children_table')}</span>
          <p className="rg-heading">{tableCategory.name}</p>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {formatSum(tableCategory.ratePerPerson)} / {t('person')}
          </p>
        </div>
        <button type="button"
            onClick={() => setChildrenTableSelected(!childrenTableSelected)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={childrenTableSelected
              ? { background: '#22c55e', color: 'var(--adm-bg)', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
            {childrenTableSelected ? `✓ ${t('children_table_included')}` : t('add_children_table')}
          </button>
      </div>

      {childrenTableSelected && (
        <div className="tablet-fade-in">
          {/* Children count */}
          <div className="mb-6" style={{ maxWidth: 260 }}>
            <p className="rg-label" style={{ marginBottom: 6 }}>{t('children_count')}</p>
            <input type="number" min={0} value={childrenCount || ''}
              onChange={(e) => setChildrenCount(e.target.value === '' ? 0 : Number(e.target.value))}
              className="rg-input" />
          </div>

          <CourseChoiceSection
            tableCategory={tableCategory} t={t} locale={locale} onLightbox={onLightbox} showName={false}
            hotAppetizerMax={tableCategory.hotAppetizerCount ?? 3}
            hotAppetizerSelectedIds={childHotAppetizerIds}
            firstSelectedId={childFirstCourseId}
            secondSelectedIds={childSecondCourseIds}
            thirdSelectedIds={childThirdCourseIds}
            onToggleHotAppetizer={(id) => toggleChildHotAppetizer(id, tableCategory.hotAppetizerCount ?? 3)}
            onFirst={setChildFirstCourse}
            onToggleSecond={toggleChildSecondCourse}
            onToggleThird={toggleChildThirdCourse}
          />

          <div className="mt-6">
            <IncludedDishesSection
              tableCategory={tableCategory} menuItems={menuItems} t={t} locale={locale} onLightbox={onLightbox}
              showName={false}
              replacements={childReplacements} onReplacement={setChildReplacement}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ── Selected-dishes summary shown at the very top, above the table photo ──────
// The guest's picks (hot appetizers + first/second/third courses) are flattened
// into a single ordered list where each dish is identified primarily by its
// SERVING ORDER ("First Serving", "Second Serving", …) rather than its menu
// category. Each row shows an expandable photo beside the dish name.

// Ordinal words 1..10 per locale; beyond that we fall back to the raw number.
const SERVING_ORDINALS: Record<Locale, string[]> = {
  en: ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'],
  ru: ['Первая', 'Вторая', 'Третья', 'Четвёртая', 'Пятая', 'Шестая', 'Седьмая', 'Восьмая', 'Девятая', 'Десятая'],
  uz: ['Birinchi', 'Ikkinchi', 'Uchinchi', 'Tortinchi', 'Beshinchi', 'Oltinchi', 'Yettinchi', 'Sakkizinchi', 'Toqqizinchi', 'Oninchi'],
};

function servingLabel(index: number, locale: Locale, t: TFn) {
  const ordinal = SERVING_ORDINALS[locale]?.[index] ?? String(index + 1);
  const word = t('serving_word');
  // Uzbek/English read "Ordinal Word"; Russian reads "Ordinal word" too.
  return `${ordinal} ${word}`;
}

function SelectedDishesBar({
  hotIds, firstId, secondIds, thirdIds, extras, packageItems, menuItems, locale, t, onLightbox,
  onPickFreeCourse, onRemovePaid,
}: {
  hotIds: string[];
  firstId?: string;
  secondIds: string[];
  thirdIds: string[];
  // Paid "Additional" selections: menu-item id → quantity (>0 = selected).
  extras: Record<string, number>;
  packageItems: TableCategoryPackageItem[];
  menuItems: MenuItem[];
  locale: Locale;
  t: TFn;
  onLightbox: (src: string | null) => void;
  // Swap a paid main dish for a free course option of the same category.
  onPickFreeCourse: (category: MenuCategory, freeItemId: string) => void;
  onRemovePaid: (paidItemId: string) => void;
}) {
  // The paid main dish whose "swap for free" picker is open.
  const [swapFor, setSwapFor] = useState<MenuItem | null>(null);
  const themeAccent = usePublicDataStore((s) => s.tabletAccentColor);
  const themeBg = usePublicDataStore((s) => s.tabletBgColor);

  const resolve = (ids: string[]) =>
    ids.map((id) => menuItems.find((m) => m.id === id)).filter((m): m is MenuItem => !!m);

  // Rows are grouped by serving category so a paid main dish sits alongside the
  // free pick of the same course. Free picks come from the course selection;
  // paid main dishes are the "Additional" selections in a course category.
  type Row = { item: MenuItem; paid: boolean; category: MenuCategory };
  const freeByCat: Record<string, MenuItem[]> = {
    HOT_APPETIZERS: resolve(hotIds),
    FIRST_COURSE: resolve(firstId ? [firstId] : []),
    SECOND_COURSE: resolve(secondIds),
    THIRD_COURSE: resolve(thirdIds),
  };
  const paidCourseItems = menuItems.filter(
    (m) => (extras[m.id] ?? 0) > 0 && COURSE_CATEGORIES.includes(m.category)
  );
  const rows: Row[] = [];
  for (const cat of COURSE_CATEGORIES) {
    for (const m of freeByCat[cat] ?? []) rows.push({ item: m, paid: false, category: cat });
    for (const m of paidCourseItems.filter((p) => p.category === cat)) rows.push({ item: m, paid: true, category: cat });
  }

  if (rows.length === 0) return null;

  // Free course options of a category that a paid dish can be swapped for.
  const freeOptionsFor = (category: MenuCategory) =>
    packageItems.filter((pi) => pi.menuItem.category === category).map((pi) => pi.menuItem);

  return (
    <section className="rg-card reveal" style={{ padding: 'clamp(14px, 2.5vw, 20px)' }}>
      <p className="rg-label" style={{ marginBottom: 12 }}>{t('your_selection')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(({ item: it, paid, category }, i) => {
          const photoSrc = it.photoUrl ? getPhotoUrl(it.photoUrl) : null;
          const canSwap = paid && freeOptionsFor(category).length > 0;
          return (
            <div key={`${it.id}-${i}`} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              padding: 8, borderRadius: 14,
              background: paid ? 'rgba(59,130,246,0.1)' : 'rgba(var(--rg-accent-rgb),0.08)',
              border: `1px solid ${paid ? 'rgba(59,130,246,0.4)' : 'rgba(var(--rg-accent-rgb),0.22)'}`,
            }}>
              {/* Serving-order badge */}
              <span style={{
                flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%',
                backgroundImage: 'linear-gradient(135deg, var(--rg-accent-soft) 0%, var(--rg-accent) 100%)',
                color: 'var(--rg-bg)', fontWeight: 800, fontSize: 14,
                boxShadow: '0 4px 12px rgba(var(--rg-accent-rgb),0.4)',
              }}>{i + 1}</span>

              {/* Expandable photo, matching the dish cards below */}
              {photoSrc ? (
                <button type="button" onClick={() => onLightbox(photoSrc)}
                  style={{
                    flexShrink: 0, width: 56, height: 56, borderRadius: 10, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.14)', padding: 0, cursor: 'zoom-in', background: 'transparent',
                  }}>
                  <img src={photoSrc} alt={dishName(it, locale)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </button>
              ) : (
                <div style={{
                  flexShrink: 0, width: 56, height: 56, borderRadius: 10,
                  background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Serving label (primary) + dish name (secondary) + paid tag/swap */}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'rgba(var(--rg-accent-rgb),0.9)',
                }}>
                  {servingLabel(i, locale, t)}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
                  {dishName(it, locale)}
                </p>
                {paid && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.03em',
                      color: '#93c5fd', background: 'rgba(59,130,246,0.16)', border: '1px solid rgba(59,130,246,0.45)',
                    }}>★ {t('status_paid')}</span>
                    {canSwap && (
                      <button type="button" onClick={() => setSwapFor(it)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
                          fontSize: 11.5, fontWeight: 700,
                          color: 'var(--rg-accent-soft)', background: 'rgba(var(--rg-accent-rgb),0.12)',
                          border: '1px solid rgba(var(--rg-accent-rgb),0.4)',
                        }}>
                        ⇄ {t('swap_free')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Swap-a-paid-dish-for-a-free-course-option picker */}
      {swapFor && createPortal(
        <div onClick={() => setSwapFor(null)}
          style={{
            ...tabletThemeVars({ accent: themeAccent, bg: themeBg }),
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(6,14,9,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          } as React.CSSProperties}>
          <div onClick={(e) => e.stopPropagation()} className="tablet-fade-up"
            style={{
              width: '100%', maxWidth: 760, maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(var(--rg-bg-rgb),0.98) 0%, rgba(var(--rg-bg-dark-rgb),0.98) 100%)',
              border: '1px solid rgba(var(--rg-accent-rgb),0.35)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ minWidth: 0 }}>
                <p className="rg-label" style={{ margin: 0 }}>{dishName(swapFor, locale)}</p>
                <h3 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 800, color: '#fff' }}>{t('choose_replacement')}</h3>
              </div>
              <button type="button" onClick={() => setSwapFor(null)} aria-label={t('cancel')}
                style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 22, lineHeight: 1, cursor: 'pointer' }}>×</button>
            </div>
            <div className="scrollbar-none" style={{ overflowY: 'auto', padding: 18, display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))' }}>
              {freeOptionsFor(swapFor.category).map((opt) => {
                const optPhoto = opt.photoUrl ? getPhotoUrl(opt.photoUrl) : null;
                return (
                  <button key={opt.id} type="button"
                    onClick={() => { onPickFreeCourse(swapFor.category, opt.id); onRemovePaid(swapFor.id); setSwapFor(null); }}
                    style={{ textAlign: 'left', padding: 0, cursor: 'pointer', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.05)', border: '2px solid rgba(255,255,255,0.1)' }}>
                    {optPhoto ? (
                      <img src={optPhoto} alt={dishName(opt, locale)} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ height: 150, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="34" height="34" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>{dishName(opt, locale)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

// Fixed bottom-right button to toggle the kiosk background music on/off.
function TabletMusicToggle() {
  const [playing, setPlaying] = useState(isTabletMusicStarted());
  const toggle = () => {
    if (isTabletMusicStarted()) { pauseTabletMusic(); setPlaying(false); }
    else { resumeTabletMusic(); setPlaying(true); }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? 'Pause music' : 'Play music'}
      style={{
        // Sits above the fixed "View Summary" CTA bar so it's never obscured.
        position: 'fixed', bottom: 'calc(84px + env(safe-area-inset-bottom))', right: 18, zIndex: 61,
        width: 52, height: 52, borderRadius: '50%',
        background: 'var(--rg-accent)', color: '#1a1a1a',
        border: '2px solid rgba(255,255,255,0.85)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {playing ? (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
      ) : (
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
      )}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export const TabletMenuPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const {
    selectedItems, selectedHallId, selectedTableCategoryId, guestCount,
    selectedHotAppetizerIds, selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
    setQuantity, setHall, setTableCategory, toggleHotAppetizer, setFirstCourse, toggleSecondCourse, toggleThirdCourse,
    replacements, setReplacement,
    setGuestCount, locale, setLocale,
  } = useTabletStore();
  const menuItems         = usePublicDataStore((s) => s.menuItems);
  const halls             = usePublicDataStore((s) => s.halls);
  const tableCategories   = usePublicDataStore((s) => s.tableCategories);
  const restaurantName    = usePublicDataStore((s) => s.restaurantName);
  const restaurantLogoUrl = usePublicDataStore((s) => s.restaurantLogoUrl);
  const tabletAccentColor = usePublicDataStore((s) => s.tabletAccentColor);
  const tabletBgColor     = usePublicDataStore((s) => s.tabletBgColor);
  const tabletParticles         = usePublicDataStore((s) => s.tabletParticles);
  const tabletParticlesColor    = usePublicDataStore((s) => s.tabletParticlesColor);
  const tabletParticlesImageUrl = usePublicDataStore((s) => s.tabletParticlesImageUrl);
  const tabletTrailTemplate     = usePublicDataStore((s) => s.tabletTrailTemplate);
  const tabletTrailColor        = usePublicDataStore((s) => s.tabletTrailColor);
  const tabletTrailImageUrl     = usePublicDataStore((s) => s.tabletTrailImageUrl);
  const isLoading         = usePublicDataStore((s) => s.isLoading);
  const error             = usePublicDataStore((s) => s.error);
  const loadPublicData    = usePublicDataStore((s) => s.loadPublicData);

  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // The paid Extra currently choosing which included dish it should replace.
  const [replacingExtra, setReplacingExtra] = useState<MenuItem | null>(null);
  const [welcomeShown, setWelcomeShown] = useState(isTabletWelcomeShown());

  // Reveal-on-scroll: re-scan when major content swaps in (table category chosen,
  // data finishes loading, category filter changes).
  const revealRef = useScrollReveal<HTMLDivElement>([selectedTableCategoryId, isLoading, activeCategory, welcomeShown]);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  useEffect(() => {
    if (restaurantId) loadPublicData(restaurantId);
  }, [loadPublicData, restaurantId]);

  // A restaurant with a single hall gives the guest no choice to make, so the
  // field is answered for them as soon as the halls arrive. Keyed on the halls
  // list ALONE, and read through getState() rather than the render's value: an
  // effect that also watched the selection would re-assert the default the
  // moment anyone cleared the field, which no amount of tapping could undo.
  useEffect(() => {
    const only = soleHallId(halls);
    if (only && !useTabletStore.getState().selectedHallId) setHall(only);
  }, [halls]);

  // Reset table-category selection on every mount so the slide reappears
  // each time a guest navigates back to this page (kiosk behavior). Two cases
  // keep the current selection instead: the admin Events page hands off a draft
  // (prefill=1), and returning from the Summary page to edit the selection
  // (fromSummary state) — there the guest's saved settings/dishes must persist.
  useEffect(() => {
    const keepSelection =
      searchParams.get('prefill') === '1' ||
      !!(location.state as { fromSummary?: boolean } | null)?.fromSummary;
    if (!keepSelection) setTableCategory('');
  }, []);

  const dismissWelcome = () => {
    startTabletMusic();
    markTabletWelcomeShown();
    setWelcomeShown(true);
  };

  const selectedTableCategory = tableCategories?.find((tc) => tc.id === selectedTableCategoryId);

  // Dishes already included in the chosen table package (courses + included dishes)
  // shouldn't be offered again as paid "Additional" items.
  const includedItemIds = new Set((selectedTableCategory?.packageItems ?? []).map((pi) => pi.menuItem.id));
  const isSelectableAdditional = (item: MenuItem) =>
    ADDITIONAL_CATEGORIES.includes(item.category) &&
    isPaidExtra(tabletStatusOf(item)) &&
    !includedItemIds.has(item.id);

  const sortedAndFiltered = quickSort(
    (menuItems ?? []).filter(
      (item) => isSelectableAdditional(item) &&
        (activeCategory === null || item.category === activeCategory)
    )
  );
  // Paid dishes that belong to a COURSE category, offered beside the
  // complimentary options while the guest is picking their courses. They are the
  // same rows the Additional section sells — one selection, shown twice, so
  // adding a premium main here also ticks it there.
  const paidCourseOptions = (menuItems ?? []).filter(
    (item) => COURSE_CATEGORIES.includes(item.category) && isSelectableAdditional(item),
  );
  const paidSelectedIds = Object.keys(selectedItems).filter((id) => (selectedItems[id] ?? 0) > 0);
  const togglePaid = (id: string) => setQuantity(id, (selectedItems[id] ?? 0) > 0 ? 0 : 1);

  // Single active children's table (if any) — shown as an optional add-on table.
  const childrenTableCategory = tableCategories?.find((tc) => tc.isActive && tc.tableType === 'CHILDREN');

  return (
    <main className="rg-bg relative min-h-screen overflow-x-hidden px-3 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8"
      style={tabletThemeVars({ accent: tabletAccentColor, bg: tabletBgColor }) as React.CSSProperties}>
      {/* Bottom-right music on/off toggle, like the catering site. */}
      {welcomeShown && <TabletMusicToggle />}
      {!welcomeShown && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(8,18,12,0.85)', backdropFilter: 'blur(10px)',
            padding: '20px',
          }}
        >
          <div
            className="tablet-fade-up"
            style={{
              width: '100%', maxWidth: 560,
              borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(var(--rg-bg-rgb),0.95) 0%, rgba(var(--rg-bg-dark-rgb),0.95) 100%)',
              border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(var(--rg-accent-rgb),0.12)',
              padding: '32px 28px',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            {/* Language switcher */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              {locales.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLocale(loc); }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: locale === loc ? 'rgba(var(--rg-accent-rgb),0.6)' : 'rgba(255,255,255,0.15)',
                    background: locale === loc ? 'rgba(var(--rg-accent-rgb),0.18)' : 'rgba(255,255,255,0.04)',
                    color: locale === loc ? 'var(--rg-accent)' : 'rgba(255,255,255,0.7)',
                    fontWeight: locale === loc ? 700 : 500,
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {loc}
                </button>
              ))}
            </div>

            {restaurantLogoUrl && (
              <img
                src={getPhotoUrl(restaurantLogoUrl)}
                alt={restaurantName ?? ''}
                style={{
                  maxHeight: 110, maxWidth: '80%', height: 'auto', width: 'auto',
                  objectFit: 'contain',
                  margin: '0 auto 18px',
                  display: 'block',
                }}
              />
            )}
            <h2 className="rg-display" style={{
              margin: 0, fontSize: 26, letterSpacing: '-0.01em',
              color: 'var(--rg-accent)',
            }}>
              {t('welcome_title')}
            </h2>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)' }}>
                {t('welcome_intro')}
              </p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.82)' }}>
                {t('welcome_help')}
              </p>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                {t('welcome_bon_appetit')}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissWelcome}
              style={{
                marginTop: 26,
                padding: '12px 36px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, var(--rg-accent) 0%, var(--rg-accent-soft) 100%)',
                color: 'var(--rg-bg)',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(var(--rg-accent-rgb),0.35)',
              }}
            >
              {t('welcome_continue')} →
            </button>
          </div>
        </div>
      )}

      {welcomeShown && !selectedTableCategoryId && !isLoading &&
        tableCategories.filter((tc) => tc.isActive && tc.tableType !== 'CHILDREN').length > 0 && (
          <TableCategoryFullscreen
            tableCategories={tableCategories.filter((tc) => tc.isActive && tc.tableType !== 'CHILDREN')}
            onSelect={(id) => setTableCategory(id)}
            onBack={() => navigate('/')}
            onLightbox={setLightboxSrc}
            locale={locale}
            setLocale={setLocale}
            t={t}
          />
        )}

      <PageBackground />
      {tabletParticles && tabletParticles !== 'none' && (
        <ParticleField
          kind={tabletParticles as ParticleKind}
          color={tabletParticlesColor || tabletAccentColor || '#d8b45f'}
          imageUrl={tabletParticlesImageUrl ? (getPhotoUrl(tabletParticlesImageUrl) ?? tabletParticlesImageUrl) : null}
          fixed
        />
      )}
      <FingerTrail
        accent={tabletTrailColor || tabletAccentColor || '#d8b45f'}
        template={(tabletTrailTemplate as TrailTemplate) || 'sparkle'}
        imageUrl={tabletTrailImageUrl ? (getPhotoUrl(tabletTrailImageUrl) ?? tabletTrailImageUrl) : null}
      />
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} compact />}
      {replacingExtra && selectedTableCategory && (
        <ExtraReplaceModal
          extra={replacingExtra}
          candidates={(selectedTableCategory.packageItems ?? []).filter(
            (pi) => pi.menuItem.category === replacingExtra.category && !COURSE_CATEGORIES.includes(pi.menuItem.category)
          )}
          replacements={replacements}
          menuItems={menuItems ?? []}
          locale={locale}
          t={t}
          onChoose={(piId) => { setReplacement(piId, replacingExtra.id); setQuantity(replacingExtra.id, 0); setReplacingExtra(null); }}
          onClose={() => setReplacingExtra(null)}
        />
      )}

      <div ref={revealRef} className="relative mx-auto max-w-7xl space-y-4 sm:space-y-6">

        {/* ── Header ── */}
        <header className="tablet-fade-in overflow-hidden rounded-2xl sm:rounded-[28px] px-4 sm:px-8 py-4 sm:py-5 shadow-2xl"
          style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)' }}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {restaurantLogoUrl && (
                <img src={getPhotoUrl(restaurantLogoUrl)}
                  alt={restaurantName ?? ''}
                  className="h-10 sm:h-14"
                  style={{ width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
              )}
              <div className="min-w-0">
                {restaurantName && <p className="rg-label truncate">{restaurantName}</p>}
                <h1 className="text-base sm:text-2xl font-bold text-white truncate">{t('client_menu_selection')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}
                className="rg-input" style={{ width: 'auto', paddingRight: '2rem', fontSize: '0.8rem' }}>
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek')}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.15)' }}>
                ← {t('events')}
              </button>
            </div>
          </div>
        </header>

        {/* ── Main content (full width — CTA lives in the fixed bottom bar) ── */}
        <section className="grid grid-cols-1 gap-4 lg:gap-6">

          {/* ── Content column ── */}
          <div className="min-w-0 space-y-4 lg:space-y-6">

            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading">{t('room_table_settings')}</p>
              <p className="mt-1 mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {t('choose_room_table_details')}
              </p>
              {/* The three answers everything below is built from. They used to be
                  three identical grey fields, so at a glance a guest could not
                  tell which they had already given — each now carries its own
                  answered / waiting state (see `.rg-pick` in index.css). */}
              <div className="grid gap-4 lg:grid-cols-3">
                <PickField label={t('select_room')} answered={!!selectedHallId}>
                  <select value={selectedHallId || ''} onChange={(e) => setHall(e.target.value)}
                    disabled={isLoading} className="rg-input">
                    <option value="">{t('choose_room')}</option>
                    {halls.filter((h) => h.isActive).map((h) => (
                      <option key={h.id} value={h.id}>{h.name} · {t('capacity')}: {h.capacity}</option>
                    ))}
                  </select>
                </PickField>

                <PickField label={t('select_table_category')} answered={!!selectedTableCategoryId}>
                  <select value={selectedTableCategoryId || ''} onChange={(e) => setTableCategory(e.target.value)}
                    disabled={isLoading} className="rg-input">
                    <option value="">{t('choose_table_category')}</option>
                    {tableCategories.filter((tc) => tc.isActive && tc.tableType !== 'CHILDREN').map((tc) => (
                      <option key={tc.id} value={tc.id}>{tableCategoryLabel(tc, t('person'))}</option>
                    ))}
                  </select>
                </PickField>

                <PickField label={t('guests')} answered={guestCount > 0}>
                  <input type="number" min={0} value={guestCount || ''}
                    onChange={(e) => setGuestCount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="rg-input" />
                </PickField>
              </div>
              {selectedHallId && selectedTableCategoryId && (
                <div className="mt-5 flex flex-wrap gap-2 tablet-fade-in">
                  <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'rgba(var(--rg-accent-rgb),0.2)', color: 'var(--rg-accent)', border: '1px solid rgba(var(--rg-accent-rgb),0.35)' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: 'var(--rg-accent)' }} />
                    {halls.find((h) => h.id === selectedHallId)?.name}
                  </span>
                  <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                    {selectedTableCategory ? tableCategoryLabel(selectedTableCategory, t('person')) : null}
                  </span>
                  <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                    {guestCount} {t('guests')}
                  </span>
                </div>
              )}
            </section>

            {/* Table category photos */}
            {selectedTableCategory && (selectedTableCategory.photos ?? []).length > 0 && (
              <section className="rg-card overflow-hidden reveal">
                <div className="px-6 pt-5 pb-3">
                  <p className="rg-label">
                    {selectedTableCategory.name}
                    <TablePrice category={selectedTableCategory} t={t} />
                  </p>
                  <p className="rg-heading mt-1">{t('table_photos')}</p>
                </div>
                <div className="scrollbar-none flex gap-3 overflow-x-auto px-6 pb-5">
                  {(selectedTableCategory.photos ?? []).map((url, i) => (
                    <button key={i} type="button"
                      onClick={() => setLightboxSrc(getPhotoUrl(url) ?? null)}
                      className="group relative shrink-0 overflow-hidden rounded-xl transition-all duration-300 hover:shadow-xl tablet-fade-up"
                      style={{ animationDelay: `${i * 60}ms`, width: 150, height: 104 }}>
                      <img src={getPhotoUrl(url)} alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                        <svg className="h-8 w-8 text-white opacity-0 drop-shadow transition-opacity duration-200 group-hover:opacity-100"
                          fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Selected dishes summary — below the table photos */}
            {selectedTableCategory && (
              <SelectedDishesBar
                hotIds={selectedHotAppetizerIds}
                firstId={selectedFirstCourseId}
                secondIds={selectedSecondCourseIds}
                thirdIds={selectedThirdCourseIds}
                extras={selectedItems}
                packageItems={selectedTableCategory.packageItems ?? []}
                menuItems={menuItems ?? []}
                locale={locale}
                t={t}
                onLightbox={setLightboxSrc}
                onPickFreeCourse={(category, freeId) => {
                  if (category === 'HOT_APPETIZERS') toggleHotAppetizer(freeId, selectedTableCategory.hotAppetizerCount ?? 3);
                  else if (category === 'FIRST_COURSE') setFirstCourse(freeId);
                  else if (category === 'SECOND_COURSE') toggleSecondCourse(freeId);
                  else if (category === 'THIRD_COURSE') toggleThirdCourse(freeId);
                }}
                onRemovePaid={(id) => setQuantity(id, 0)}
              />
            )}

            {/* Course choice — shared component (adult table) */}
            {selectedTableCategory && (
              <CourseChoiceSection
                tableCategory={selectedTableCategory} t={t} locale={locale} onLightbox={setLightboxSrc} card
                hotAppetizerMax={selectedTableCategory.hotAppetizerCount ?? 3}
                hotAppetizerSelectedIds={selectedHotAppetizerIds}
                firstSelectedId={selectedFirstCourseId}
                secondSelectedIds={selectedSecondCourseIds}
                thirdSelectedIds={selectedThirdCourseIds}
                onToggleHotAppetizer={(id) => toggleHotAppetizer(id, selectedTableCategory.hotAppetizerCount ?? 3)}
                onFirst={setFirstCourse}
                onToggleSecond={toggleSecondCourse}
                onToggleThird={toggleThirdCourse}
                paidOptions={paidCourseOptions}
                paidSelectedIds={paidSelectedIds}
                onTogglePaid={togglePaid}
              />
            )}

            {/* Included dishes — shared component (adult table) */}
            {selectedTableCategory && (
              <IncludedDishesSection
                tableCategory={selectedTableCategory} menuItems={menuItems ?? []} t={t} locale={locale}
                onLightbox={setLightboxSrc} card
                replacements={replacements} onReplacement={setReplacement}
              />
            )}

            {/* Children's table — optional add-on, shown before Additional */}
            {selectedTableCategory && childrenTableCategory && (
              <ChildrenTableSection
                tableCategory={childrenTableCategory} menuItems={menuItems ?? []} t={t} locale={locale}
                onLightbox={setLightboxSrc}
              />
            )}

            {/* Additional — premium highlighted section */}
            <section className="reveal" style={{
              position: 'relative', borderRadius: 24, padding: 'clamp(16px, 3vw, 26px)',
              background: 'linear-gradient(165deg, rgba(var(--rg-accent-rgb),0.13) 0%, rgba(var(--rg-bg-rgb),0.35) 45%, rgba(255,255,255,0.03) 100%)',
              border: '1px solid rgba(var(--rg-accent-rgb),0.32)',
              boxShadow: '0 14px 44px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.07)',
            }}>
              {/* Soft gold glow accent in the corner */}
              <div aria-hidden style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', pointerEvents: 'none',
                background: 'radial-gradient(circle, rgba(var(--rg-accent-rgb),0.22) 0%, transparent 70%)' }} />

              {/* Premium header */}
              <div className="mb-4 flex items-center gap-3" style={{ position: 'relative' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(145deg, var(--rg-accent-soft), var(--rg-accent))', boxShadow: '0 6px 20px rgba(var(--rg-accent-rgb),0.45)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--rg-bg)">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
                <div>
                  <p className="rg-heading" style={{ margin: 0, fontSize: 'clamp(18px, 2.4vw, 23px)',
                    background: 'linear-gradient(90deg, var(--rg-accent-soft), var(--rg-accent))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                    {t('additional')}
                  </p>
                  <p className="text-sm" style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.55)' }}>{t('browse_menu_items')}</p>
                </div>
              </div>
              <div style={{ height: 1, marginBottom: 18, background: 'linear-gradient(90deg, rgba(var(--rg-accent-rgb),0.7) 0%, rgba(var(--rg-accent-rgb),0.08) 70%, transparent 100%)' }} />

              {/* The category filter is a column down the LEFT on anything wider
                  than a phone: this list runs to thirty-odd categories, and as a
                  horizontal strip above the dishes it was a scroller whose far
                  end nobody found. Below `sm` it stays a strip — a 190px rail on
                  a phone would leave the dish grid a single column. */}
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
                <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1 sm:w-[190px] sm:shrink-0 sm:flex-col sm:overflow-visible sm:pb-0">
                  {[null, ...ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat && isSelectableAdditional(item)))].map((cat) => (
                    <button key={cat ?? 'all'} type="button" onClick={() => setActiveCategory(cat)}
                      className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-200 sm:w-full sm:whitespace-normal sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-left"
                      style={activeCategory === cat
                        ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)', boxShadow: '0 4px 14px rgba(var(--rg-accent-rgb),0.35)' }
                        : { background: 'rgba(var(--rg-accent-rgb),0.08)', color: 'rgba(217,184,74,0.9)', border: '1px solid rgba(var(--rg-accent-rgb),0.28)' }}>
                      {cat === null ? t('filter_all') : t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                    </button>
                  ))}
                </div>

                <div className="min-w-0 flex-1">
              {isLoading ? (
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rg-shimmer h-52 rounded-2xl" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl p-6 text-sm" style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>{error}</div>
              ) : sortedAndFiltered.length > 0 ? (
                <div key={activeCategory ?? 'all'} className="tablet-fade-in"
                  style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
                  {sortedAndFiltered.map((item, i) => {
                    // Included complimentary dishes of the same category this paid
                    // Extra could stand in for (courses are guest-picked, excluded).
                    const candidates = (selectedTableCategory?.packageItems ?? []).filter(
                      (pi) => pi.menuItem.category === item.category && !COURSE_CATEGORIES.includes(pi.menuItem.category)
                    );
                    // Is this Extra already replacing one of those included dishes?
                    const replEntry = Object.entries(replacements).find(([, v]) => v === item.id);
                    const replacedPi = replEntry ? (selectedTableCategory?.packageItems ?? []).find((pi) => pi.id === replEntry[0]) : undefined;
                    return (
                    <div key={item.id} className="tablet-fade-up h-full" style={{ animationDelay: `${i * 45}ms` }}>
                      <MenuItemCard item={item} quantity={selectedItems[item.id] ?? 0}
                        onQuantityChange={(qty) => setQuantity(item.id, qty)} dark locale={locale} toggleMode
                        replace={selectedTableCategory ? {
                          canReplace: candidates.length > 0,
                          activeTargetName: replacedPi ? dishName(replacedPi.menuItem, locale) : null,
                          onOpen: () => setReplacingExtra(item),
                          onRevert: () => { if (replEntry) setReplacement(replEntry[0], null); },
                        } : undefined} />
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl py-14"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                  <svg className="mb-3 h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No items in this category</p>
                </div>
              )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>

      {/* ── Sticky bottom CTA — all screen sizes ── */}
      <div
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
            padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
            background: 'rgba(8,18,12,0.85)', backdropFilter: 'blur(14px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
          <div className="mx-auto max-w-7xl">
            <button type="button" onClick={() => navigate('/tablet/summary')}
              className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 active:scale-[0.99]"
              style={{ background: 'var(--rg-accent)', color: 'var(--rg-bg)', boxShadow: '0 6px 20px rgba(var(--rg-accent-rgb),0.35)' }}>
              {t('view_summary')} →
            </button>
          </div>
        </div>
    </main>
  );
};
