import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { Locale, locales, translate } from '../utils/translate';
import type { MenuItem, TableCategory, TabletStatus } from '../types/domain';
import { getPhotoUrl } from '../utils/photoUrl';
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
        background: 'radial-gradient(circle, rgba(201,164,44,0.22) 0%, transparent 65%)',
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
        background: 'radial-gradient(circle, rgba(201,164,44,0.07) 0%, transparent 70%)',
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
                borderColor: locale === loc ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.15)',
                background: locale === loc ? 'rgba(201,164,44,0.18)' : 'rgba(255,255,255,0.04)',
                color: locale === loc ? '#c9a42c' : 'rgba(255,255,255,0.7)',
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
            t={t}
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
            border: '1px solid rgba(201,164,44,0.35)',
            background: 'rgba(201,164,44,0.1)',
            color: '#c9a42c', fontSize: 22, fontWeight: 700, lineHeight: 1,
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
                background: i === currentIdx ? '#c9a42c' : 'rgba(255,255,255,0.25)',
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
            border: '1px solid rgba(201,164,44,0.35)',
            background: 'rgba(201,164,44,0.1)',
            color: '#c9a42c', fontSize: 22, fontWeight: 700, lineHeight: 1,
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
  tc, index, total, onSelect, onLightbox, t,
}: {
  tc: TableCategory;
  index: number;
  total: number;
  onSelect: () => void;
  onLightbox: (src: string) => void;
  t: TFn;
}) {
  const photos = (tc.photos ?? []).filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);

  const includedCats = tc.includedCategories
    ? tc.includedCategories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const photoPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const photoNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i + 1) % photos.length);
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
              <button type="button"
                onClick={() => onLightbox(getPhotoUrl(photos[photoIdx]) ?? '')}
                style={{ display: 'block', width: '100%', height: '100%', border: 'none', padding: 0, background: 'transparent', cursor: 'zoom-in' }}>
                <img key={photoIdx} src={getPhotoUrl(photos[photoIdx])} alt={tc.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  className="scale-in" />
              </button>
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
            margin: '8px 0 0', fontSize: 18, fontWeight: 700, color: '#c9a42c',
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

        {/* Included categories */}
        {includedCats.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {includedCats.map((cat) => (
              <span key={cat} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: 'rgba(201,164,44,0.15)', color: '#c9a42c',
                border: '1px solid rgba(201,164,44,0.3)',
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
            background: 'linear-gradient(135deg, #c9a42c 0%, #d4af37 100%)',
            color: '#1a3320',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.02em',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(201,164,44,0.35)',
          }}>
          {t('select_table')} →
        </button>
      </div>
    </div>
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
  // each time a guest navigates back to this page (kiosk behavior).
  useEffect(() => {
    setTableCategory('');
  }, []);

  const dismissWelcome = () => {
    startTabletMusic();
    markTabletWelcomeShown();
    setWelcomeShown(true);
  };

  const sortedAndFiltered = quickSort(
    (menuItems ?? []).filter(
      (item) => ADDITIONAL_CATEGORIES.includes(item.category) &&
        tabletStatusOf(item) === 'PAID' &&
        (activeCategory === null || item.category === activeCategory)
    )
  );
  const selectedTableCategory = tableCategories?.find((tc) => tc.id === selectedTableCategoryId);

  return (
    <main className="rg-bg relative min-h-screen overflow-x-hidden px-3 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">
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
              background: 'linear-gradient(135deg, rgba(26,51,32,0.95) 0%, rgba(15,33,20,0.95) 100%)',
              border: '1px solid rgba(201,164,44,0.35)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(201,164,44,0.12)',
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
                    borderColor: locale === loc ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.15)',
                    background: locale === loc ? 'rgba(201,164,44,0.18)' : 'rgba(255,255,255,0.04)',
                    color: locale === loc ? '#c9a42c' : 'rgba(255,255,255,0.7)',
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
              color: '#c9a42c',
            }}>
              {t('welcome_title', { restaurant: restaurantName ?? '' })}
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
                background: 'linear-gradient(135deg, #c9a42c 0%, #d4af37 100%)',
                color: '#1a3320',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.02em',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(201,164,44,0.35)',
              }}
            >
              {t('welcome_continue')} →
            </button>
          </div>
        </div>
      )}

      {welcomeShown && !selectedTableCategoryId && !isLoading &&
        tableCategories.filter((tc) => tc.isActive).length > 0 && (
          <TableCategoryFullscreen
            tableCategories={tableCategories.filter((tc) => tc.isActive)}
            onSelect={(id) => setTableCategory(id)}
            onLightbox={setLightboxSrc}
            locale={locale}
            setLocale={setLocale}
            t={t}
          />
        )}

      <PageBackground />
      <FingerTrail accent="#c9a42c" />
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

        {/* ── Main grid ── */}
        <section className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[1.35fr_0.65fr]">

          {/* ── Left column ── */}
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
                      ...tableCategories.filter((tc) => tc.isActive).map((tc) => ({ value: tc.id, label: tc.name }))] },
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
                    style={{ background: 'rgba(201,164,44,0.2)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.35)' }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: '#c9a42c' }} />
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

            {/* Course choice (first + second + third course) */}
            {selectedTableCategory && (() => {
              const courseGroups = [
                {
                  category: 'FIRST_COURSE' as const,
                  labelKey: 'choose_first_course' as const,
                  multi: false,
                  isSelected: (id: string) => selectedFirstCourseId === id,
                  onToggle: (id: string) => setFirstCourse(id),
                },
                {
                  category: 'SECOND_COURSE' as const,
                  labelKey: 'choose_second_course' as const,
                  multi: true,
                  isSelected: (id: string) => selectedSecondCourseIds.includes(id),
                  onToggle: toggleSecondCourse,
                },
                {
                  category: 'THIRD_COURSE' as const,
                  labelKey: 'choose_third_course' as const,
                  multi: true,
                  isSelected: (id: string) => selectedThirdCourseIds.includes(id),
                  onToggle: toggleThirdCourse,
                },
              ]
                .map((cfg) => ({
                  ...cfg,
                  items: (selectedTableCategory.packageItems ?? []).filter((pi) => pi!.menuItem.category === cfg.category),
                }))
                .filter((group) => group.items.length > 0);
              if (courseGroups.length === 0) return null;
              return (
                <section className="rg-card p-4 sm:p-6 reveal">
                  {/* Decorated courses heading */}
                  <div className="mb-6" style={{ textAlign: 'center' }}>
                    <p className="rg-label">{selectedTableCategory.name}</p>
                    <h2 style={{
                      margin: '6px 0 0', fontSize: 28, fontWeight: 800,
                      letterSpacing: '0.04em', textTransform: 'uppercase',
                      backgroundImage: 'linear-gradient(135deg, #f0d878 0%, #c9a42c 60%, #b8941f 100%)',
                      WebkitBackgroundClip: 'text', backgroundClip: 'text',
                      WebkitTextFillColor: 'transparent', color: '#c9a42c',
                      textShadow: '0 2px 18px rgba(201,164,44,0.25)',
                    }}>{t('courses')}</h2>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
                      <span style={{ height: 1, width: 64, background: 'linear-gradient(90deg, transparent, rgba(201,164,44,0.7))' }} />
                      <span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: '#c9a42c', boxShadow: '0 0 10px rgba(201,164,44,0.85)' }} />
                      <span style={{ height: 1, width: 64, background: 'linear-gradient(90deg, rgba(201,164,44,0.7), transparent)' }} />
                    </div>
                  </div>

                  {courseGroups.map((group, gi) => (
                    <div key={group.category} className={gi < courseGroups.length - 1 ? 'mb-8' : ''}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        {/* Numbered gold badge */}
                        <div style={{
                          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundImage: 'linear-gradient(135deg, #f0d878 0%, #c9a42c 100%)',
                          color: '#1a3320', fontWeight: 800, fontSize: 20,
                          boxShadow: '0 6px 18px rgba(201,164,44,0.45)',
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
                              color: '#e0c25a', background: 'rgba(201,164,44,0.14)', border: '1px solid rgba(201,164,44,0.34)',
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
                        {group.items.map((pi, i) => {
                          const item = pi!.menuItem;
                          const selected = group.isSelected(item.id);
                          const photoSrc = item.photoUrl ? getPhotoUrl(item.photoUrl) : null;
                          return (
                            <div key={item.id}
                              className="tablet-fade-up"
                              style={{
                                animationDelay: `${i * 50}ms`,
                                position: 'relative', borderRadius: 14, overflow: 'hidden',
                                outline: selected ? '2px solid #c9a42c' : '1px solid rgba(255,255,255,0.12)',
                                outlineOffset: selected ? 2 : 0,
                                background: selected ? 'rgba(201,164,44,0.12)' : 'rgba(255,255,255,0.06)',
                                transition: 'outline 0.18s, background 0.18s',
                              }}>
                              {/* Photo — click to open lightbox */}
                              {photoSrc ? (
                                <button type="button"
                                  onClick={() => setLightboxSrc(photoSrc)}
                                  style={{ display: 'block', width: '100%', border: 'none', padding: 0, cursor: 'zoom-in', background: 'transparent', position: 'relative' }}>
                                  <img src={photoSrc} alt={item.name}
                                    style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                                  <div style={{
                                    position: 'absolute', inset: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'rgba(0,0,0,0)', transition: 'background 0.18s',
                                  }}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.25)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)'; }}
                                  >
                                    <svg width="28" height="28" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ opacity: 0, transition: 'opacity 0.18s' }}
                                      className="zoom-icon">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                    </svg>
                                  </div>
                                </button>
                              ) : (
                                <div style={{ height: 120, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="30" height="30" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                              {/* Name + checkbox row */}
                              <button type="button"
                                onClick={() => group.onToggle(item.id)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8,
                                  width: '100%', padding: '8px 10px',
                                  border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                                }}>
                                {/* Checkbox/radio indicator */}
                                <div style={{
                                  flexShrink: 0,
                                  width: 20, height: 20, borderRadius: group.multi ? 6 : '50%',
                                  border: `2px solid ${selected ? '#c9a42c' : 'rgba(255,255,255,0.3)'}`,
                                  background: selected ? '#c9a42c' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s',
                                }}>
                                  {selected && (
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                      <path d="M2 6l3 3 5-5" stroke="#1a3320" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: selected ? '#c9a42c' : '#fff', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                                  {item.description && (
                                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })()}

            {/* Included dishes (all categories except the choosable courses) */}
            {selectedTableCategory && (() => {
              const includedItems = (selectedTableCategory.packageItems ?? []).filter(
                (pi) => pi!.menuItem.category !== 'FIRST_COURSE' && pi!.menuItem.category !== 'SECOND_COURSE' && pi!.menuItem.category !== 'THIRD_COURSE'
              );
              if (includedItems.length === 0) return null;
              const grouped = Object.entries(
                includedItems.reduce<Record<string, typeof includedItems>>(
                  (acc, pi) => { const cat = pi!.menuItem.category; if (!acc[cat]) acc[cat] = []; acc[cat]!.push(pi!); return acc; }, {}
                )
              ).sort(([a], [b]) => (CATEGORY_ORDER[a as MenuCategory] ?? 99) - (CATEGORY_ORDER[b as MenuCategory] ?? 99));
              return (
                <section className="rg-card p-4 sm:p-6 reveal">
                  <div className="mb-5">
                    <p className="rg-label">{selectedTableCategory.name}</p>
                    <p className="rg-heading mt-1">{t('included_with_table')}</p>
                  </div>
                  {grouped.map(([cat, items], catIndex) => (
                    <div key={cat} style={{
                      paddingTop: catIndex > 0 ? 20 : 0,
                      marginTop: catIndex > 0 ? 20 : 0,
                      borderTop: catIndex > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 3, height: 16, borderRadius: 2, background: '#c9a42c', flexShrink: 0 }} />
                        <span style={{
                          display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                          color: '#d9b84a', background: 'rgba(201,164,44,0.12)', border: '1px solid rgba(201,164,44,0.28)',
                        }}>
                          {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px, 100%), 1fr))' }}>
                        {items!.map((pi, i) => {
                          // Free alternatives the guest may swap this included dish for, at no cost.
                          const freeAlts = (menuItems ?? []).filter(
                            (m) => m.category === pi!.menuItem.category && tabletStatusOf(m) === 'FREE' && m.id !== pi!.menuItem.id
                          );
                          const chosenId = replacements[pi!.id];
                          const displayItem = chosenId ? ((menuItems ?? []).find((m) => m.id === chosenId) ?? pi!.menuItem) : pi!.menuItem;
                          const isSwapped = displayItem.id !== pi!.menuItem.id;
                          return (
                          <div key={pi!.id}
                            className="group overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg tablet-fade-up"
                            style={{ animationDelay: `${i * 50}ms`, background: 'rgba(255,255,255,0.06)', border: `1px solid ${isSwapped ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.12)'}` }}>
                            {displayItem.photoUrl ? (
                              <button type="button"
                                onClick={() => setLightboxSrc(getPhotoUrl(displayItem.photoUrl) ?? null)}
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
                              <p className="text-sm font-semibold leading-snug text-white">{displayItem.name}</p>
                              {displayItem.description && (
                                <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                  {displayItem.description}
                                </p>
                              )}
                              {!viewOnly && freeAlts.length > 0 && (
                                <div className="mt-2.5">
                                  <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(96,165,250,0.85)', marginBottom: 5 }}>
                                    {t('swap_free')}
                                  </label>
                                  <select
                                    value={chosenId ?? pi!.menuItem.id}
                                    onChange={(e) => setReplacement(pi!.id, e.target.value === pi!.menuItem.id ? null : e.target.value)}
                                    style={{
                                      width: '100%', padding: '7px 9px', borderRadius: 9,
                                      background: 'rgba(0,0,0,0.35)', color: '#fff',
                                      border: `1px solid ${isSwapped ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.15)'}`,
                                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    <option value={pi!.menuItem.id} style={{ background: '#1a2e20', color: '#fff' }}>
                                      {pi!.menuItem.name} ({t('included_default')})
                                    </option>
                                    {freeAlts.map((alt) => (
                                      <option key={alt.id} value={alt.id} style={{ background: '#1a2e20', color: '#fff' }}>
                                        {alt.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })()}

            {/* Additional */}
            <section className="rg-card p-4 sm:p-6 reveal">
              <p className="rg-heading mb-1">{t('additional')}</p>
              <p className="mb-5 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{t('browse_menu_items')}</p>

              {/* Category pills */}
              <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
                {[null, ...ADDITIONAL_CATEGORIES.filter((cat) => (menuItems ?? []).some((item) => item.category === cat && tabletStatusOf(item) === 'PAID'))].map((cat) => (
                  <button key={cat ?? 'all'} type="button" onClick={() => setActiveCategory(cat)}
                    className="shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-all duration-200"
                    style={activeCategory === cat
                      ? { background: '#c9a42c', color: '#1a3320', boxShadow: '0 4px 14px rgba(201,164,44,0.35)' }
                      : { background: 'rgba(201,164,44,0.08)', color: 'rgba(217,184,74,0.9)', border: '1px solid rgba(201,164,44,0.28)' }}>
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
                        onQuantityChange={(qty) => setQuantity(item.id, qty)} dark viewOnly={viewOnly} />
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

          {/* ── Sidebar — desktop only, hidden in view-only mode ── */}
          {!viewOnly && (
          <aside className="hidden min-w-0 space-y-4 lg:block lg:sticky lg:top-6 lg:self-start">
            {/* CTA */}
            <section className="rg-card p-4 sm:p-5 space-y-3 reveal">
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>{t('review_and_confirm')}</p>
              <button type="button" onClick={() => navigate('/tablet/summary')}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 hover:shadow-lg"
                style={{ background: '#c9a42c', color: '#1a3320' }}>
                {t('view_summary')} →
              </button>
            </section>
          </aside>
          )}
        </section>
      </div>

      {/* ── Mobile sticky CTA — hidden on desktop & in view-only mode ── */}
      {!viewOnly && (
        <div className="lg:hidden"
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
            padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
            background: 'rgba(8,18,12,0.85)', backdropFilter: 'blur(14px)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
          <button type="button" onClick={() => navigate('/tablet/summary')}
            className="w-full rounded-xl py-3 text-sm font-bold transition-all duration-200 active:scale-[0.99]"
            style={{ background: '#c9a42c', color: '#1a3320', boxShadow: '0 6px 20px rgba(201,164,44,0.35)' }}>
            {t('view_summary')} →
          </button>
        </div>
      )}
    </main>
  );
};
