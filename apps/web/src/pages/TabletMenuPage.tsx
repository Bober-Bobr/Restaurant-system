import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { Locale, locales, translate } from '../utils/translate';
import type { MenuItem } from '../types/domain';
import { getPhotoUrl } from '../utils/photoUrl';
import { Lightbox } from '../components/ui/lightbox';
import logo from '../assets/logo.png';

type MenuCategory = MenuItem['category'];

const CATEGORY_ORDER: Record<MenuCategory, number> = {
  COLD_APPETIZERS: 0,
  HOT_APPETIZERS: 1,
  SALADS: 2,
  FIRST_COURSE: 3,
  SECOND_COURSE: 4,
  DRINKS: 5,
  SWEETS: 6,
  FRUITS: 7,
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
  'COLD_APPETIZERS',
  'HOT_APPETIZERS',
  'SALADS',
  'DRINKS',
  'SWEETS',
  'FRUITS',
];

const COURSE_CATEGORIES: MenuCategory[] = ['FIRST_COURSE', 'SECOND_COURSE'];

// ── TableCategoryCard ─────────────────────────────────────────────────────

import type { TableCategory } from '../types/domain';

type TFn = (key: Parameters<typeof translate>[0]) => string;

function TableCategoryCard({
  tc,
  isSelected,
  onSelect,
  onLightbox,
  t,
}: {
  tc: TableCategory;
  isSelected: boolean;
  onSelect: () => void;
  onLightbox: (src: string) => void;
  t: TFn;
}) {
  const photos = (tc.photos ?? []).filter(Boolean);
  const [photoIdx, setPhotoIdx] = useState(0);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i - 1 + photos.length) % photos.length);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIdx((i) => (i + 1) % photos.length);
  };

  const includedCats = tc.includedCategories
    ? tc.includedCategories.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-300 hover:shadow-xl ${
        isSelected ? 'border-stone-900 ring-2 ring-stone-900' : 'border-stone-200 hover:border-stone-400'
      }`}
      style={{ width: 300 }}
    >
      {/* Photo area */}
      <div className="relative h-52 bg-stone-100">
        {photos.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => onLightbox(getPhotoUrl(photos[photoIdx]) ?? '')}
              className="block h-full w-full"
            >
              <img
                key={photoIdx}
                src={getPhotoUrl(photos[photoIdx])}
                alt={tc.name}
                className="scale-in h-full w-full object-cover"
              />
            </button>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity duration-200 hover:bg-black/60 group-hover:opacity-100"
                  style={{ opacity: 1 }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white opacity-0 transition-opacity duration-200 hover:bg-black/60 group-hover:opacity-100"
                  style={{ opacity: 1 }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPhotoIdx(i); }}
                      className={`rounded-full bg-white transition-all duration-200 ${
                        i === photoIdx ? 'w-4 opacity-100' : 'w-1.5 opacity-60'
                      } h-1.5`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <svg className="h-12 w-12 text-stone-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Price badge */}
        <div className="absolute right-3 top-3 rounded-full bg-stone-900/90 px-3 py-1 text-xs font-semibold text-white shadow backdrop-blur-sm">
          ${(tc.ratePerPerson / 100).toFixed(0)}{' '}
          <span className="font-normal opacity-75">/ {t('person')}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="text-base font-semibold text-stone-900">{tc.name}</h3>
          {tc.description && (
            <p className="mt-1 line-clamp-2 text-xs text-stone-500">{tc.description}</p>
          )}
        </div>

        {includedCats.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {includedCats.map((cat) => (
              <span
                key={cat}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600"
              >
                {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
              </span>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onSelect}
          className={`mt-auto w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
            isSelected
              ? 'bg-emerald-500 text-white shadow-md'
              : 'bg-stone-900 text-white hover:bg-stone-700'
          }`}
        >
          {isSelected ? '✓ ' + t('selected') : t('select_table')}
        </button>
      </div>
    </div>
  );
}

// ── TableCategoryShowcase ─────────────────────────────────────────────────

function TableCategoryShowcase({
  tableCategories,
  selectedId,
  onSelect,
  onLightbox,
  t,
}: {
  tableCategories: TableCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLightbox: (src: string) => void;
  t: TFn;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -340 : 340, behavior: 'smooth' });
  };

  const active = tableCategories.filter((tc) => tc.isActive);
  if (active.length === 0) return null;

  return (
    <section className="tablet-fade-up" style={{ animationDelay: '40ms' }}>
      <div className="mb-4 flex items-center justify-between px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
            {t('choose_table_category')}
          </p>
          <p className="mt-0.5 text-xl font-semibold text-stone-900">{t('table_categories')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-all duration-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition-all duration-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow"
          >
            ›
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-none flex gap-4 overflow-x-auto pb-2"
      >
        {active.map((tc, i) => (
          <div key={tc.id} className="tablet-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <TableCategoryCard
              tc={tc}
              isSelected={tc.id === selectedId}
              onSelect={() => onSelect(tc.id)}
              onLightbox={onLightbox}
              t={t}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export const TabletMenuPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const restaurantId = searchParams.get('restaurantId') ?? '';
  const {
    selectedItems, selectedHallId, selectedTableCategoryId, guestCount,
    setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale
  } = useTabletStore();
  const menuItems      = usePublicDataStore((s) => s.menuItems);
  const halls          = usePublicDataStore((s) => s.halls);
  const tableCategories = usePublicDataStore((s) => s.tableCategories);
  const isLoading      = usePublicDataStore((s) => s.isLoading);
  const error          = usePublicDataStore((s) => s.error);
  const loadPublicData = usePublicDataStore((s) => s.loadPublicData);

  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) =>
    translate(key, locale, params);

  useEffect(() => {
    if (restaurantId) loadPublicData(restaurantId);
  }, [loadPublicData, restaurantId]);

  const sortedAndFiltered = quickSort(
    (menuItems ?? []).filter(
      (item) =>
        ADDITIONAL_CATEGORIES.includes(item.category) &&
        (activeCategory === null || item.category === activeCategory)
    )
  );

  const courseItems = quickSort(
    (menuItems ?? []).filter((item) => COURSE_CATEGORIES.includes(item.category))
  );

  const selectedTableCategory = tableCategories?.find((tc) => tc.id === selectedTableCategoryId);
  const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);

  const pricingRows = [
    { key: 'subtotal',        label: t('subtotal'),        value: pricing.subtotalCents },
    { key: 'service_fee',     label: t('service_fee'),     value: pricing.serviceFeeCents },
    { key: 'tax',             label: t('tax'),             value: pricing.taxCents },
    ...(guestCount > 1
      ? [{ key: 'per_guest', label: t('price_per_guest'), value: pricing.perGuestCents }]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#f9f7f4] px-4 py-6 sm:px-6 lg:px-8">
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Header ── */}
        <header className="tablet-fade-in overflow-hidden rounded-[32px] bg-stone-900 px-8 py-6 shadow-xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img
                src={logo}
                alt="logo"
                className="h-14 w-14 rounded-2xl object-cover shadow-lg ring-2 ring-stone-500 ring-offset-2 ring-offset-stone-900 bg-white"
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.3em] text-stone-400">Madinabek</p>
                <h1 className="text-2xl font-semibold text-white">{t('client_menu_selection')}</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-auto border-stone-700 bg-stone-800 text-black focus:border-stone-500 focus:ring-stone-700"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {t(l === 'en' ? 'english' : l === 'ru' ? 'russian' : 'uzbek')}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-800 px-4 py-2.5 text-sm font-medium text-stone-200 transition-colors hover:bg-stone-700"
              >
                ← {t('events')}
              </button>
            </div>
          </div>
        </header>

        {/* ── Table category showcase ── */}
        {!isLoading && tableCategories.filter((tc) => tc.isActive).length > 0 && (
          <TableCategoryShowcase
            tableCategories={tableCategories}
            selectedId={selectedTableCategoryId ?? null}
            onSelect={(id) => setTableCategory(id)}
            onLightbox={setLightboxSrc}
            t={t}
          />
        )}

        {/* ── Main grid ── */}
        <section className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">

          {/* ── Left column ── */}
          <div className="space-y-6">

            {/* Settings */}
            <section className="card p-6 tablet-fade-up" style={{ animationDelay: '60ms' }}>
              <p className="section-heading">{t('room_table_settings')}</p>
              <p className="mt-1 mb-5 text-sm text-stone-500">{t('choose_room_table_details')}</p>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('select_room')}
                  </label>
                  <Select
                    value={selectedHallId || ''}
                    onChange={(e) => setHall(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="">{t('choose_room')}</option>
                    {halls.filter((h) => h.isActive).map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} · {t('capacity')}: {h.capacity}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('select_table_category')}
                  </label>
                  <Select
                    value={selectedTableCategoryId || ''}
                    onChange={(e) => setTableCategory(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="">{t('choose_table_category')}</option>
                    {tableCategories.filter((tc) => tc.isActive).map((tc) => (
                      <option key={tc.id} value={tc.id}>{tc.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {t('guests')}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
                  />
                </div>
              </div>

              {selectedHallId && selectedTableCategoryId && (
                <div className="mt-5 flex flex-wrap gap-2 tablet-fade-in">
                  <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-1.5 text-sm font-medium text-white">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {halls.find((h) => h.id === selectedHallId)?.name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-700">
                    {tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-700">
                    {guestCount} {t('guests')}
                  </span>
                </div>
              )}
            </section>

            {/* Table category photos */}
            {selectedTableCategory && (selectedTableCategory.photos ?? []).length > 0 && (
              <section className="card overflow-hidden tablet-fade-up" style={{ animationDelay: '90ms' }}>
                <div className="px-6 pt-5 pb-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {selectedTableCategory.name}
                  </p>
                  <p className="section-heading mt-1">{t('table_photos')}</p>
                </div>
                <div className="scrollbar-none flex gap-3 overflow-x-auto px-6 pb-5">
                  {(selectedTableCategory.photos ?? []).map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightboxSrc(getPhotoUrl(url) ?? null)}
                      className="group relative shrink-0 overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:shadow-lg tablet-fade-up"
                      style={{ animationDelay: `${i * 60}ms`, width: 200, height: 140 }}
                    >
                      <img
                        src={getPhotoUrl(url)}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/15">
                        <svg
                          className="h-8 w-8 text-white opacity-0 drop-shadow transition-opacity duration-200 group-hover:opacity-100"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Included dishes */}
            {selectedTableCategory && (selectedTableCategory.packageItems ?? []).length > 0 && (
              <section className="card p-6 tablet-fade-up" style={{ animationDelay: '100ms' }}>
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                    {selectedTableCategory.name}
                  </p>
                  <p className="section-heading mt-1">{t('included_with_table')}</p>
                </div>

                {Object.entries(
                  (selectedTableCategory.packageItems ?? []).reduce<
                    Record<string, typeof selectedTableCategory.packageItems>
                  >((acc, pi) => {
                    const cat = pi!.menuItem.category;
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat]!.push(pi!);
                    return acc;
                  }, {})
                )
                  .sort(
                    ([a], [b]) =>
                      (CATEGORY_ORDER[a as MenuCategory] ?? 99) -
                      (CATEGORY_ORDER[b as MenuCategory] ?? 99)
                  )
                  .map(([cat, items]) => (
                    <div key={cat} className="mb-6 last:mb-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
                        {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items!.map((pi, i) => (
                          <div
                            key={pi!.id}
                            className="group overflow-hidden rounded-2xl border border-stone-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md tablet-fade-up"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            {pi!.menuItem.photoUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxSrc(getPhotoUrl(pi!.menuItem.photoUrl) ?? null)
                                }
                                className="block w-full overflow-hidden"
                              >
                                <img
                                  src={getPhotoUrl(pi!.menuItem.photoUrl)}
                                  alt={pi!.menuItem.name}
                                  className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                                />
                              </button>
                            ) : (
                              <div className="flex h-36 items-center justify-center bg-stone-50">
                                <svg
                                  className="h-8 w-8 text-stone-200"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            )}
                            <div className="p-3">
                              <p className="text-sm font-semibold leading-snug text-stone-900">
                                {pi!.menuItem.name}
                              </p>
                              {pi!.menuItem.description && (
                                <p className="mt-0.5 line-clamp-2 text-xs text-stone-400">
                                  {pi!.menuItem.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </section>
            )}

            {/* Courses */}
            {selectedTableCategory && courseItems.length > 0 && (
              <section className="card p-6 tablet-fade-up" style={{ animationDelay: '140ms' }}>
                <div className="mb-5">
                  <p className="section-heading">{t('courses')}</p>
                  <p className="mt-1 text-sm text-stone-500">{t('browse_menu_items')}</p>
                </div>
                {COURSE_CATEGORIES.map((cat) => {
                  const items = courseItems.filter((item) => item.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="mb-6 last:mb-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
                        {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item, i) => (
                          <div
                            key={item.id}
                            className="tablet-fade-up"
                            style={{ animationDelay: `${i * 50}ms` }}
                          >
                            <MenuItemCard
                              item={item}
                              quantity={selectedItems[item.id] ?? 0}
                              onQuantityChange={(qty) => setQuantity(item.id, qty)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            {/* Additional */}
            <section className="card p-6 tablet-fade-up" style={{ animationDelay: '180ms' }}>
              <div className="mb-5">
                <p className="section-heading">{t('additional')}</p>
                <p className="mt-1 text-sm text-stone-500">{t('browse_menu_items')}</p>
              </div>

              {/* Category pills */}
              <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                    activeCategory === null
                      ? 'bg-stone-900 text-white shadow-md'
                      : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                  }`}
                >
                  {t('filter_all')}
                </button>
                {ADDITIONAL_CATEGORIES.filter((cat) =>
                  (menuItems ?? []).some((item) => item.category === cat)
                ).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${
                      activeCategory === cat
                        ? 'bg-stone-900 text-white shadow-md'
                        : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="skeleton-shimmer h-72 rounded-3xl"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-3xl bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
              ) : sortedAndFiltered.length > 0 ? (
                <div
                  key={activeCategory ?? 'all'}
                  className="tablet-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {sortedAndFiltered.map((item, i) => (
                    <div
                      key={item.id}
                      className="tablet-fade-up"
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <MenuItemCard
                        item={item}
                        quantity={selectedItems[item.id] ?? 0}
                        onQuantityChange={(qty) => setQuantity(item.id, qty)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-100 py-14 text-stone-400">
                  <svg className="mb-3 h-9 w-9 text-stone-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No items in this category</p>
                </div>
              )}
            </section>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            {/* Pricing summary */}
            <section
              className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm tablet-fade-up"
              style={{ animationDelay: '220ms' }}
            >
              <div className="bg-stone-900 px-6 py-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                  {t('summary')}
                </p>
              </div>
              <div className="px-6 pt-2 pb-2">
                <div className="divide-y divide-stone-100">
                  {pricingRows.map(({ key, label, value }) => (
                    <div key={key} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-stone-500">{label}</span>
                      <span className="font-medium text-stone-900">
                        ${(value / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 pb-6">
                <div className="rounded-2xl bg-stone-900 px-5 py-4 text-white">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {t('total')}
                    </span>
                    <span className="text-2xl font-bold">
                      ${(pricing.totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* CTA */}
            <section
              className="card p-5 space-y-3 tablet-fade-up"
              style={{ animationDelay: '260ms' }}
            >
              <p className="text-sm text-stone-500">{t('review_and_confirm')}</p>
              <Button
                className="w-full"
                size="lg"
                onClick={() => navigate('/tablet/summary')}
              >
                {t('view_summary')} →
              </Button>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
};
