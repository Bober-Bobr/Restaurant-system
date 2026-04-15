import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { usePublicDataStore } from '../store/publicData.store';
import { useTabletStore } from '../store/tablet.store';
import { Locale, locales, translate } from '../utils/translate';
import type { MenuItem } from '../types/domain';
import { getPhotoUrl } from '../utils/photoUrl';
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

// Shown in the "Additional" section — first/second course handled separately
const ADDITIONAL_CATEGORIES: MenuCategory[] = [
  'COLD_APPETIZERS',
  'HOT_APPETIZERS',
  'SALADS',
  'DRINKS',
  'SWEETS',
  'FRUITS',
];

const COURSE_CATEGORIES: MenuCategory[] = ['FIRST_COURSE', 'SECOND_COURSE'];

export const TabletMenuPage = () => {
  const navigate = useNavigate();
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale } = useTabletStore();
  const menuItems = usePublicDataStore((state) => state.menuItems);
  const halls = usePublicDataStore((state) => state.halls);
  const tableCategories = usePublicDataStore((state) => state.tableCategories);
  const isLoading = usePublicDataStore((state) => state.isLoading);
  const error = usePublicDataStore((state) => state.error);
  const loadPublicData = usePublicDataStore((state) => state.loadPublicData);

  const [activeCategory, setActiveCategory] = useState<MenuCategory | null>(null);

  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Madinabek logo" className="h-16 w-16 rounded-3xl object-cover" />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Madinabek</p>
              <h1 className="page-heading">{t('client_menu_selection')}</h1>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="text-sm text-slate-500">{t('language')}</span>
            <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className="w-full sm:w-auto">
              {locales.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
                </option>
              ))}
            </Select>
          </div>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="section-heading">{t('room_table_settings')}</p>
                  <p className="mt-1 text-sm text-slate-500">{t('choose_room_table_details')}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t('select_room')}</label>
                  <Select value={selectedHallId || ''} onChange={(e) => setHall(e.target.value)} disabled={isLoading}>
                    <option value="">{t('choose_room')}</option>
                    {halls.filter((hall) => hall.isActive).map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name} • {t('capacity')}: {hall.capacity}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t('select_table_category')}</label>
                  <Select value={selectedTableCategoryId || ''} onChange={(e) => setTableCategory(e.target.value)} disabled={isLoading}>
                    <option value="">{t('choose_table_category')}</option>
                    {tableCategories.filter((tc) => tc.isActive).map((tableCategory) => (
                      <option key={tableCategory.id} value={tableCategory.id}>
                        {tableCategory.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t('guests')}</label>
                  <Input
                    id="guest-count"
                    type="number"
                    min={1}
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
                  />
                </div>
              </div>

              {selectedHallId && selectedTableCategoryId && (
                <div className="mt-4 rounded-3xl bg-slate-50 p-4 text-sm text-slate-700">
                  <span className="font-medium">{t('selected')}:</span>{' '}
                  {halls.find((hall) => hall.id === selectedHallId)?.name} •{' '}
                  {tableCategories.find((tc) => tc.id === selectedTableCategoryId)?.name} • {guestCount} {t('guests')}
                </div>
              )}
            </section>

            {/* ── Included dishes ── */}
            {selectedTableCategory && (selectedTableCategory.packageItems ?? []).length > 0 && (
              <section className="card p-6">
                <div className="mb-5">
                  <p className="section-heading">{t('included_with_table')}</p>
                  <p className="mt-1 text-sm text-slate-500">{selectedTableCategory.name}</p>
                </div>

                {Object.entries(
                  (selectedTableCategory.packageItems ?? []).reduce<Record<string, typeof selectedTableCategory.packageItems>>(
                    (acc, pi) => {
                      const cat = pi!.menuItem.category;
                      if (!acc[cat]) acc[cat] = [];
                      acc[cat]!.push(pi!);
                      return acc;
                    },
                    {}
                  )
                )
                  .sort(([a], [b]) => (CATEGORY_ORDER[a as MenuCategory] ?? 99) - (CATEGORY_ORDER[b as MenuCategory] ?? 99))
                  .map(([cat, items]) => (
                    <div key={cat} className="mb-6 last:mb-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items!.map((pi) => (
                          <div key={pi!.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                            {pi!.menuItem.photoUrl ? (
                              <img
                                src={getPhotoUrl(pi!.menuItem.photoUrl)}
                                alt={pi!.menuItem.name}
                                className="h-16 w-16 flex-shrink-0 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-slate-200" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 leading-snug">{pi!.menuItem.name}</p>
                              {pi!.menuItem.description && (
                                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{pi!.menuItem.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </section>
            )}

            {/* ── Courses section (shown when table category selected) ── */}
            {selectedTableCategory && courseItems.length > 0 && (
              <section className="card p-6">
                <div className="mb-4">
                  <p className="section-heading">{t('courses')}</p>
                  <p className="mt-1 text-sm text-slate-500">{t('browse_menu_items')}</p>
                </div>
                {[...COURSE_CATEGORIES].map((cat) => {
                  const items = courseItems.filter((item) => item.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat} className="mb-6 last:mb-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                          <MenuItemCard
                            key={item.id}
                            item={item}
                            quantity={selectedItems[item.id] ?? 0}
                            onQuantityChange={(qty) => setQuantity(item.id, qty)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            <section className="card p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="section-heading">{t('additional')}</p>
                  <p className="mt-1 text-sm text-slate-500">{t('browse_menu_items')}</p>
                </div>
              </div>

              {/* Category filter bar */}
              <div className="mb-5 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    activeCategory === null
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t('filter_all')}
                </button>
                {ADDITIONAL_CATEGORIES.filter((cat) =>
                  (menuItems ?? []).some((item) => item.category === cat)
                ).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t(cat.toLowerCase() as Parameters<typeof translate>[0])}
                  </button>
                ))}
              </div>

              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-56 rounded-3xl bg-slate-100" />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-3xl bg-rose-50 p-6 text-sm text-rose-700">
                  {error}
                </div>
              ) : sortedAndFiltered.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedAndFiltered.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      quantity={selectedItems[item.id] ?? 0}
                      onQuantityChange={(nextQuantity) => setQuantity(item.id, nextQuantity)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">
                  No menu items are available right now.
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="card p-6">
              <p className="section-heading">{t('summary')}</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <span>{t('subtotal')}</span>
                  <span>${(pricing.subtotalCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <span>{t('service_fee')}</span>
                  <span>${(pricing.serviceFeeCents / 100).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                  <span>{t('tax')}</span>
                  <span>${(pricing.taxCents / 100).toFixed(2)}</span>
                </div>
                {guestCount > 1 && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3">
                    <span>{t('price_per_guest')}</span>
                    <span>${(pricing.perGuestCents / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="mt-6 rounded-3xl bg-slate-900 p-4 text-white">
                <div className="flex items-center justify-between text-sm uppercase tracking-[0.2em] text-slate-400">
                  <span>{t('total')}</span>
                  <span>${(pricing.totalCents / 100).toFixed(2)}</span>
                </div>
              </div>
            </section>

            <section className="card p-6 space-y-3">
              <p className="section-heading">{t('next_step')}</p>
              <p className="text-sm text-slate-500">{t('review_and_confirm')}</p>
                <Button className="w-full" onClick={() => navigate('/tablet/summary')}>
                {t('view_summary')}
              </Button>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
};
