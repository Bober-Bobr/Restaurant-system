import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { publicMenuService } from '../services/publicMenu.service';
import { publicHallService } from '../services/publicHall.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { useTabletStore } from '../store/tablet.store';
import { defaultLocale, Locale, locales, translate } from '../utils/translate';
import logo from '../assets/logo.png';

export const TabletMenuPage = () => {
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount, locale, setLocale } = useTabletStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  const { data: menuItems, isLoading: menuLoading, isError: menuError } = useQuery({
    queryKey: ['menu-items', 'public'],
    queryFn: () => publicMenuService.listActive()
  });

  const { data: halls, isLoading: hallsLoading } = useQuery({
    queryKey: ['halls', 'public'],
    queryFn: () => publicHallService.listActive()
  });

  const { data: tableCategories, isLoading: tableCategoriesLoading } = useQuery({
    queryKey: ['table-categories', 'public'],
    queryFn: () => publicTableCategoryService.listActive()
  });

  const selectedTableCategory = tableCategories?.find(tc => tc.id === selectedTableCategoryId);

  const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);

  return (
    <main style={{ padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img
          src={logo}
          alt="Restaurant logo"
          style={{ width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' }}
        />
        <h1>{t('client_menu_selection')}</h1>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>
          {t('language')}:
          <select
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            style={{ marginLeft: 8, padding: 6, borderRadius: 4, border: '1px solid #ccc' }}
          >
            {locales.map((localeOption) => (
              <option key={localeOption} value={localeOption}>
                {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Room and Table Settings */}
      <section style={{ marginBottom: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>{t('room_table_settings')}</h3>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="hall-select" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              {t('select_room')}:
            </label>
            <select
              id="hall-select"
              value={selectedHallId || ''}
              onChange={(e) => setHall(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={hallsLoading}
            >
              <option value="">{t('choose_room')}</option>
              {(halls ?? []).filter(h => h.isActive).map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} (Capacity: {hall.capacity})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="table-select" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              {t('select_table_category')}:
            </label>
            <select
              id="table-select"
              value={selectedTableCategoryId || ''}
              onChange={(e) => setTableCategory(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={tableCategoriesLoading}
            >
              <option value="">{t('choose_table_category')}</option>
              {(tableCategories ?? []).filter(tc => tc.isActive).map((tableCategory) => (
                <option key={tableCategory.id} value={tableCategory.id}>
                  {tableCategory.name} - {tableCategory.mealPackage} (${(tableCategory.ratePerPerson / 100).toFixed(2)}/person)
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 120 }}>
            <label htmlFor="guest-count" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              {t('guests')}:
            </label>
            <input
              id="guest-count"
              type="number"
              min="1"
              value={guestCount}
              onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            />
          </div>
        </div>

        {selectedHallId && selectedTableCategoryId && (
          <div style={{ padding: 8, backgroundColor: '#f0f8ff', borderRadius: 4 }}>
            <strong>{t('selected')}:</strong> {halls?.find(h => h.id === selectedHallId)?.name} | {tableCategories?.find(tc => tc.id === selectedTableCategoryId)?.name} | {guestCount} {t('guests').toLowerCase()}
          </div>
        )}
      </section>

      {menuLoading ? <p>{t('loading_menu')}</p> : null}
      {menuError ? <p>{t('failed_load_menu')}</p> : null}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
          gap: 12,
          marginBottom: 20
        }}
      >
        {(menuItems ?? []).map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            quantity={selectedItems[item.id] ?? 0}
            onQuantityChange={(nextQuantity) => setQuantity(item.id, nextQuantity)}
          />
        ))}
      </section>

      <section style={{ borderTop: '1px solid #ddd', paddingTop: 12 }}>
        <h3>{t('real_time_estimate')}</h3>
        <p>{t('subtotal')}: ${(pricing.subtotalCents / 100).toFixed(2)}</p>
        <p>{t('service_fee')}: ${(pricing.serviceFeeCents / 100).toFixed(2)}</p>
        <p>{t('tax')}: ${(pricing.taxCents / 100).toFixed(2)}</p>
        <strong>{t('total')}: ${(pricing.totalCents / 100).toFixed(2)}</strong>
        {guestCount > 1 && (
          <p>{t('per_guest')}: ${(pricing.perGuestCents / 100).toFixed(2)}</p>
        )}
      </section>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link
          to="/tablet/summary"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 4,
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {t('view_summary')}
        </Link>
      </div>
    </main>
  );
};
