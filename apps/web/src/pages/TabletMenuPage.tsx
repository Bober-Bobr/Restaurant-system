import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { Locale, locales, translate } from '../utils/translate';
import type { MenuItem, TableCategory, TableCategoryPackageItem, TabletStatus } from '../types/domain';
import { getPhotoUrl } from '../utils/photoUrl';
import { tabletThemeVars } from '../utils/tabletTheme';
import { dishName, dishDescription } from '../utils/menuI18n';
import { Lightbox } from '../components/ui/lightbox';
import { formatSum } from '../utils/currency';
import { startTabletMusic, isTabletWelcomeShown, markTabletWelcomeShown } from '../utils/tabletMusic';
import { FingerTrail } from '../components/FingerTrail';
import { useScrollReveal } from '../utils/useScrollReveal';

type MenuCategory = MenuItem['category'];
type TFn = (key: Parameters<typeof translate>[0]) => string;

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

// Tablet status of a menu item, with a fallback for pre-migration items that
// only have the old showOnTablet boolean (shown → PAID, hidden → NONE).
function tabletStatusOf(item: MenuItem): TabletStatus {
  if (item.tabletStatus) return item.tabletStatus;
  return item.showOnTablet === false ? 'NONE' : 'PAID';
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
  tableCategories, onSelect, onLightbox, locale, setLocale, t,
}: {
  tableCategories: TableCategory[];
  onSelect: (id: string) => void;
  onLightbox: (src: string) => void;
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  // When several table categories share the same price, guests need to see how
  // they differ. For each price bracket, compute the menu-item ids COMMON to
  // every category in it; anything not common is what makes a given category
  // distinctive, so we flag those ids to highlight them on each slide.
  const { distinctiveByCat, samePriceCountByCat } = (() => {
    const priceGroups = new Map<number, TableCategory[]>();
    for (const tc of tableCategories) {
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
      background: 'linear-gradient(135deg, #0a1f12 0%, #051208 100%)',
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
        <p style={{
          margin: 0, color: 'rgba(255,255,255,0.55)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
        }}>
          {t('choose_table_category')}
        </p>
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
        {tableCategories.map((tc, i) => (
          <CategorySlide
            key={tc.id}
            tc={tc}
            index={i + 1}
            total={tableCategories.length}
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
          {tableCategories.map((_, i) => (
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
          onClick={() => goTo(Math.min(tableCategories.length - 1, currentIdx + 1))}
          disabled={currentIdx === tableCategories.length - 1}
          style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
            background: 'rgba(var(--rg-accent-rgb),0.1)',
            color: 'var(--rg-accent)', fontSize: 22, fontWeight: 700, lineHeight: 1,
            cursor: currentIdx === tableCategories.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentIdx === tableCategories.length - 1 ? 0.35 : 1,
            transition: 'opacity 0.2s',
          }}
          aria-label="Next"
        >›</button>
      </div>
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
          <h2 style={{
            margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em',
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

        {/* Description */}
        {tc.description && (
          <p style={{
            margin: 0, textAlign: 'center', maxWidth: 520,
            fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)',
          }}>{tc.description}</p>
        )}

        {/* Included dishes — grouped by category. When several tables share this
            price, the dishes that make this one different are highlighted. */}
        {dishGroups.length > 0 ? (
          <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
                {t('included_dishes')}
              </p>
              {sharedPrice && hasDistinctive && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  color: 'var(--rg-bg)', background: 'var(--rg-accent)',
                }}>
                  ★ {t('differences_highlighted')}
                </span>
              )}
            </div>
            {dishGroups.map((g) => (
              <div key={g.category}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(var(--rg-accent-rgb),0.75)' }}>
                  {t(g.category.toLowerCase() as Parameters<typeof translate>[0])}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  {g.items.map((pi) => {
                    const distinct = sharedPrice && !!distinctiveItemIds?.has(pi.menuItem.id);
                    return (
                      <span key={pi.id} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '5px 12px', borderRadius: 999, fontSize: 13, fontWeight: distinct ? 700 : 500,
                        background: distinct ? 'rgba(var(--rg-accent-rgb),0.22)' : 'rgba(255,255,255,0.06)',
                        color: distinct ? 'var(--rg-accent)' : 'rgba(255,255,255,0.8)',
                        border: `1px solid ${distinct ? 'var(--rg-accent)' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: distinct ? '0 2px 12px rgba(var(--rg-accent-rgb),0.25)' : 'none',
                      }}>
                        {distinct && <span style={{ fontSize: 11 }}>★</span>}
                        {dishName(pi.menuItem, locale)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : includedCats.length > 0 && (
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

        {/* Select button */}
        <button type="button" onClick={onSelect}
          style={{
            marginTop: 4,
            padding: '14px 48px',
            borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, var(--rg-accent) 0%, #d4af37 100%)',
            color: 'var(--rg-bg)',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.02em',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(var(--rg-accent-rgb),0.35)',
          }}>
          {t('select_table')} →
        </button>
      </div>
    </div>
  );
}

// ── Reusable: course choice (first/second/third) for a table category ─────
// Shared by the adult table and the optional children's table so both behave
// identically. `card` wraps the content in its own rg-card section.

function CourseChoiceSection({
  tableCategory, t, locale, onLightbox, card = false, showName = true,
  firstSelectedId, secondSelectedIds, thirdSelectedIds,
  onFirst, onToggleSecond, onToggleThird,
}: {
  tableCategory: TableCategory;
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
  card?: boolean;
  showName?: boolean;
  firstSelectedId?: string;
  secondSelectedIds: string[];
  thirdSelectedIds: string[];
  onFirst: (id: string) => void;
  onToggleSecond: (id: string) => void;
  onToggleThird: (id: string) => void;
}) {
  const courseGroups = [
    { category: 'FIRST_COURSE' as const, labelKey: 'choose_first_course' as const, multi: false,
      isSelected: (id: string) => firstSelectedId === id, onToggle: onFirst },
    { category: 'SECOND_COURSE' as const, labelKey: 'choose_second_course' as const, multi: true,
      isSelected: (id: string) => secondSelectedIds.includes(id), onToggle: onToggleSecond },
    { category: 'THIRD_COURSE' as const, labelKey: 'choose_third_course' as const, multi: true,
      isSelected: (id: string) => thirdSelectedIds.includes(id), onToggle: onToggleThird },
  ]
    .map((cfg) => ({ ...cfg, items: (tableCategory.packageItems ?? []).filter((pi) => pi.menuItem.category === cfg.category) }))
    .filter((group) => group.items.length > 0);
  if (courseGroups.length === 0) return null;

  // First course is single-select: once chosen, collapse the list to just the
  // picked dish and offer a button to expand it again to change the choice.
  const [firstExpanded, setFirstExpanded] = useState(false);

  const inner = (
    <>
      <div className="mb-6" style={{ textAlign: 'center' }}>
        {showName && <p className="rg-label">{tableCategory.name}</p>}
        <h2 style={{
          margin: '6px 0 0', fontSize: 28, fontWeight: 800,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          backgroundImage: 'linear-gradient(135deg, #f0d878 0%, var(--rg-accent) 60%, #b8941f 100%)',
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
        const isFirst = !group.multi;
        const selectedFirst = isFirst ? group.items.find((pi) => group.isSelected(pi.menuItem.id)) : undefined;
        const collapsed = isFirst && !!selectedFirst && !firstExpanded;
        const displayItems = collapsed
          ? group.items.filter((pi) => group.isSelected(pi.menuItem.id))
          : group.items;
        return (
        <div key={group.category} className={gi < courseGroups.length - 1 ? 'mb-8' : ''}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundImage: 'linear-gradient(135deg, #f0d878 0%, var(--rg-accent) 100%)',
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
                  padding: '3px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                  letterSpacing: '0.03em',
                  color: '#e0c25a', background: 'rgba(var(--rg-accent-rgb),0.14)', border: '1px solid rgba(var(--rg-accent-rgb),0.34)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-6" stroke="#e0c25a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t('multi_select')}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
            {displayItems.map((pi, i) => {
              const item = pi.menuItem;
              const selected = group.isSelected(item.id);
              const photoSrc = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
              return (
                <div key={item.id}
                  className="tablet-fade-up"
                  style={{
                    animationDelay: `${i * 50}ms`,
                    position: 'relative', borderRadius: 14, overflow: 'hidden',
                    outline: selected ? '2px solid var(--rg-accent)' : '1px solid rgba(255,255,255,0.12)',
                    outlineOffset: selected ? 2 : 0,
                    background: selected ? 'rgba(var(--rg-accent-rgb),0.12)' : 'rgba(255,255,255,0.06)',
                    transition: 'outline 0.18s, background 0.18s',
                  }}>
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
                    onClick={() => { group.onToggle(item.id); if (isFirst) setFirstExpanded(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 10px',
                      border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{
                      flexShrink: 0,
                      width: 20, height: 20, borderRadius: group.multi ? 6 : '50%',
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
                      {dishDescription(item, locale) && (
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {dishDescription(item, locale)}
                        </p>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {/* First course: expand/collapse the options once one is picked */}
          {isFirst && selectedFirst && group.items.length > 1 && (
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button type="button"
                onClick={() => setFirstExpanded((v) => !v)}
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
                {collapsed ? t('change_first_course') : t('collapse_options')}
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
                  {dishDescription(item, locale) && (
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.6)' }}>
                      {dishDescription(item, locale)}
                    </p>
                  )}
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

// ── Reusable: included dishes (non-course categories) with free swaps ──────

function IncludedDishesSection({
  tableCategory, menuItems, t, locale, onLightbox, viewOnly, card = false, showName = true,
  replacements, onReplacement,
}: {
  tableCategory: TableCategory;
  menuItems: MenuItem[];
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
  viewOnly: boolean;
  card?: boolean;
  showName?: boolean;
  replacements: Record<string, string>;
  onReplacement: (packageItemId: string, menuItemId: string | null) => void;
}) {
  const [editingPiId, setEditingPiId] = useState<string | null>(null);
  const includedItems = (tableCategory.packageItems ?? []).filter(
    (pi) => pi.menuItem.category !== 'FIRST_COURSE' && pi.menuItem.category !== 'SECOND_COURSE' && pi.menuItem.category !== 'THIRD_COURSE'
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

  // Dishes allowed as free substitutions for THIS table category. When the
  // category has its own list use it; otherwise fall back to the legacy global
  // MenuItem.tabletStatus === 'FREE' behavior.
  const catFreeIds = tableCategory.freeSubstitutionItemIds;
  const isFreeForThisTable = (m: MenuItem) =>
    catFreeIds != null ? catFreeIds.includes(m.id) : tabletStatusOf(m) === 'FREE';

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

  const dishGrid = (items: TableCategoryPackageItem[]) => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
      {items.map((pi, i) => {
        const freeAlts = getFreeAlts(pi);
        const chosenId = replacements[pi.id];
        const displayItem = chosenId ? ((menuItems ?? []).find((m) => m.id === chosenId) ?? pi.menuItem) : pi.menuItem;
        const isSwapped = displayItem.id !== pi.menuItem.id;
        return (
          <div key={pi.id}
            className="group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg tablet-fade-up"
            style={{ animationDelay: `${i * 50}ms`, background: 'rgba(255,255,255,0.06)', border: `1px solid ${isSwapped ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.12)'}` }}>
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
            <div className="p-2.5">
              <p className="text-sm font-semibold leading-snug text-white">{dishName(displayItem, locale)}</p>
              {dishDescription(displayItem, locale) && (
                <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {dishDescription(displayItem, locale)}
                </p>
              )}
              {!viewOnly && freeAlts.length > 0 && (
                <button type="button" onClick={() => setEditingPiId(pi.id)}
                  className="mt-2.5"
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
      })}
    </div>
  );

  const inner = (
    <>
      <div className="mb-5">
        {showName && <p className="rg-label">{tableCategory.name}</p>}
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

      {/* Small categories (< 5 items): folded into ONE combined group, rendered
          as a single bordered card so it clearly reads as one unit. Inside, each
          small category is labelled and separated from the next by a divider. */}
      {smallGroups.length > 0 && (
        <div style={{
          paddingTop: bigGroups.length > 0 ? 20 : 0,
          marginTop: bigGroups.length > 0 ? 20 : 0,
          borderTop: bigGroups.length > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}>
          <div style={{
            borderRadius: 18,
            padding: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(var(--rg-accent-rgb),0.22)',
            // Small categories sit side by side in a single row, separated by
            // vertical divider lines (wrapping to new rows only when too narrow).
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'stretch',
          }}>
            {smallGroups.map(([cat, items], si) => (
              <div key={cat} style={{
                flex: '1 1 200px',
                minWidth: 0,
                paddingLeft: si > 0 ? 16 : 0,
                borderLeft: si > 0 ? '1px dashed rgba(var(--rg-accent-rgb),0.3)' : 'none',
              }}>
                {categoryHeader(cat)}
                {dishGrid(items!)}
              </div>
            ))}
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
  tableCategory, menuItems, t, locale, onLightbox, viewOnly,
}: {
  tableCategory: TableCategory;
  menuItems: MenuItem[];
  t: TFn;
  locale: Locale;
  onLightbox: (src: string | null) => void;
  viewOnly: boolean;
}) {
  const {
    childrenTableSelected, childrenCount,
    childFirstCourseId, childSecondCourseIds, childThirdCourseIds, childReplacements,
    setChildrenTableSelected, setChildrenCount,
    setChildFirstCourse, toggleChildSecondCourse, toggleChildThirdCourse, setChildReplacement,
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
        {!viewOnly && (
          <button type="button"
            onClick={() => setChildrenTableSelected(!childrenTableSelected)}
            className="rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
            style={childrenTableSelected
              ? { background: '#22c55e', color: '#0f172a', boxShadow: '0 4px 14px rgba(34,197,94,0.35)' }
              : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.2)' }}>
            {childrenTableSelected ? `✓ ${t('children_table_included')}` : t('add_children_table')}
          </button>
        )}
      </div>

      {childrenTableSelected && (
        <div className="tablet-fade-in">
          {/* Children count */}
          <div className="mb-6" style={{ maxWidth: 260 }}>
            <p className="rg-label" style={{ marginBottom: 6 }}>{t('children_count')}</p>
            <input type="number" min={0} value={childrenCount || ''}
              disabled={viewOnly}
              onChange={(e) => setChildrenCount(e.target.value === '' ? 0 : Number(e.target.value))}
              className="rg-input" />
          </div>

          <CourseChoiceSection
            tableCategory={tableCategory} t={t} locale={locale} onLightbox={onLightbox} showName={false}
            firstSelectedId={childFirstCourseId}
            secondSelectedIds={childSecondCourseIds}
            thirdSelectedIds={childThirdCourseIds}
            onFirst={setChildFirstCourse}
            onToggleSecond={toggleChildSecondCourse}
            onToggleThird={toggleChildThirdCourse}
          />

          <div className="mt-6">
            <IncludedDishesSection
              tableCategory={tableCategory} menuItems={menuItems} t={t} locale={locale} onLightbox={onLightbox}
              viewOnly={viewOnly} showName={false}
              replacements={childReplacements} onReplacement={setChildReplacement}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export const TabletMenuPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const viewOnly = searchParams.get('viewOnly') === '1' || searchParams.get('viewOnly') === 'true';
  const {
    selectedItems, selectedHallId, selectedTableCategoryId, guestCount,
    selectedFirstCourseId, selectedSecondCourseIds, selectedThirdCourseIds,
    setQuantity, setHall, setTableCategory, setFirstCourse, toggleSecondCourse, toggleThirdCourse,
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
  const isLoading         = usePublicDataStore((s) => s.isLoading);
  const error             = usePublicDataStore((s) => s.error);
  const loadPublicData    = usePublicDataStore((s) => s.loadPublicData);

  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [welcomeShown, setWelcomeShown] = useState(isTabletWelcomeShown());

  // Reveal-on-scroll: re-scan when major content swaps in (table category chosen,
  // data finishes loading, category filter changes).
  const revealRef = useScrollReveal<HTMLDivElement>([selectedTableCategoryId, isLoading, activeCategory, welcomeShown]);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  useEffect(() => {
    if (restaurantId) loadPublicData(restaurantId);
  }, [loadPublicData, restaurantId]);

  // Reset table-category selection on every mount so the slide reappears
  // each time a guest navigates back to this page (kiosk behavior). When the
  // admin Events page hands off a draft (prefill=1), keep its pre-selected
  // table category instead of clearing it.
  useEffect(() => {
    if (searchParams.get('prefill') !== '1') setTableCategory('');
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
    tabletStatusOf(item) === 'PAID' &&
    !includedItemIds.has(item.id);

  const sortedAndFiltered = quickSort(
    (menuItems ?? []).filter(
      (item) => isSelectableAdditional(item) &&
        (activeCategory === null || item.category === activeCategory)
    )
  );
  // Single active children's table (if any) — shown as an optional add-on table.
  const childrenTableCategory = tableCategories?.find((tc) => tc.isActive && tc.tableType === 'CHILDREN');

  return (
    <main className="rg-bg relative min-h-screen overflow-x-hidden px-3 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8"
      style={tabletThemeVars({ accent: tabletAccentColor, bg: tabletBgColor }) as React.CSSProperties}>
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
            <h2 style={{
              margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em',
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
                background: 'linear-gradient(135deg, var(--rg-accent) 0%, #d4af37 100%)',
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
            onLightbox={setLightboxSrc}
            locale={locale}
            setLocale={setLocale}
            t={t}
          />
        )}

      <PageBackground />
      <FingerTrail accent="var(--rg-accent)" />
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

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

            {/* Settings — hidden in view-only mode */}
            {!viewOnly && (
            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading">{t('room_table_settings')}</p>
              <p className="mt-1 mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {t('choose_room_table_details')}
              </p>
              <div className="grid gap-4 lg:grid-cols-3">
                {[
                  { label: t('select_room'), value: selectedHallId || '', onChange: setHall,
                    options: [{ value: '', label: t('choose_room') },
                      ...halls.filter((h) => h.isActive).map((h) => ({ value: h.id, label: `${h.name} · ${t('capacity')}: ${h.capacity}` }))] },
                  { label: t('select_table_category'), value: selectedTableCategoryId || '', onChange: setTableCategory,
                    options: [{ value: '', label: t('choose_table_category') },
                      ...tableCategories.filter((tc) => tc.isActive && tc.tableType !== 'CHILDREN').map((tc) => ({ value: tc.id, label: tc.name }))] },
                ].map(({ label, value, onChange, options }) => (
                  <div key={label} className="space-y-1.5">
                    <p className="rg-label">{label}</p>
                    <select value={value} onChange={(e) => onChange(e.target.value)}
                      disabled={isLoading} className="rg-input">
                      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <p className="rg-label">{t('guests')}</p>
                  <input type="number" min={0} value={guestCount || ''}
                    onChange={(e) => setGuestCount(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="rg-input" />
                </div>
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
                    {tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name}
                  </span>
                  <span className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}>
                    {guestCount} {t('guests')}
                  </span>
                </div>
              )}
            </section>
            )}

            {/* Table category photos */}
            {selectedTableCategory && (selectedTableCategory.photos ?? []).length > 0 && (
              <section className="rg-card overflow-hidden reveal">
                <div className="px-6 pt-5 pb-3">
                  <p className="rg-label">{selectedTableCategory.name}</p>
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

            {/* Course choice — shared component (adult table) */}
            {selectedTableCategory && (
              <CourseChoiceSection
                tableCategory={selectedTableCategory} t={t} locale={locale} onLightbox={setLightboxSrc} card
                firstSelectedId={selectedFirstCourseId}
                secondSelectedIds={selectedSecondCourseIds}
                thirdSelectedIds={selectedThirdCourseIds}
                onFirst={setFirstCourse}
                onToggleSecond={toggleSecondCourse}
                onToggleThird={toggleThirdCourse}
              />
            )}

            {/* Included dishes — shared component (adult table) */}
            {selectedTableCategory && (
              <IncludedDishesSection
                tableCategory={selectedTableCategory} menuItems={menuItems ?? []} t={t} locale={locale}
                onLightbox={setLightboxSrc} viewOnly={viewOnly} card
                replacements={replacements} onReplacement={setReplacement}
              />
            )}

            {/* Children's table — optional add-on, shown before Additional */}
            {selectedTableCategory && childrenTableCategory && (
              <ChildrenTableSection
                tableCategory={childrenTableCategory} menuItems={menuItems ?? []} t={t} locale={locale}
                onLightbox={setLightboxSrc} viewOnly={viewOnly}
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

              {/* Category pills */}
              <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
                {[null, ...ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat && isSelectableAdditional(item)))].map((cat) => (
                  <button key={cat ?? 'all'} type="button" onClick={() => setActiveCategory(cat)}
                    className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-200"
                    style={activeCategory === cat
                      ? { background: 'var(--rg-accent)', color: 'var(--rg-bg)', boxShadow: '0 4px 14px rgba(var(--rg-accent-rgb),0.35)' }
                      : { background: 'rgba(var(--rg-accent-rgb),0.08)', color: 'rgba(217,184,74,0.9)', border: '1px solid rgba(var(--rg-accent-rgb),0.28)' }}>
                    {cat === null ? t('filter_all') : t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                  </button>
                ))}
              </div>

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
                  {sortedAndFiltered.map((item, i) => (
                    <div key={item.id} className="tablet-fade-up" style={{ animationDelay: `${i * 45}ms` }}>
                      <MenuItemCard item={item} quantity={selectedItems[item.id] ?? 0}
                        onQuantityChange={(qty) => setQuantity(item.id, qty)} dark viewOnly={viewOnly} locale={locale} toggleMode />
                    </div>
                  ))}
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
            </section>
          </div>
        </section>
      </div>

      {/* ── Sticky bottom CTA — all screen sizes, hidden in view-only mode ── */}
      {!viewOnly && (
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
      )}
    </main>
  );
};
