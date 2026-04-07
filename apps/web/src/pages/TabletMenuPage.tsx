import { useQuery } from '@tanstack/react-query';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { publicMenuService } from '../services/publicMenu.service';
import { publicHallService } from '../services/publicHall.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { useTabletStore } from '../store/tablet.store';
import logo from '../assets/logo.png';

export const TabletMenuPage = () => {
  const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount, setQuantity, setHall, setTableCategory, setGuestCount } = useTabletStore();

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
        <h1>Client Menu Selection</h1>
      </div>

      {/* Room and Table Settings */}
      <section style={{ marginBottom: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Room & Table Settings</h3>

        <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'end' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="hall-select" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              Select Room:
            </label>
            <select
              id="hall-select"
              value={selectedHallId || ''}
              onChange={(e) => setHall(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={hallsLoading}
            >
              <option value="">Choose a room...</option>
              {(halls ?? []).filter(h => h.isActive).map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name} (Capacity: {hall.capacity})
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1 }}>
            <label htmlFor="table-select" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              Select Table Category:
            </label>
            <select
              id="table-select"
              value={selectedTableCategoryId || ''}
              onChange={(e) => setTableCategory(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              disabled={tableCategoriesLoading}
            >
              <option value="">Choose a table category...</option>
              {(tableCategories ?? []).filter(tc => tc.isActive).map((tableCategory) => (
                <option key={tableCategory.id} value={tableCategory.id}>
                  {tableCategory.name} - {tableCategory.mealPackage} (${(tableCategory.ratePerPerson / 100).toFixed(2)}/person)
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: 120 }}>
            <label htmlFor="guest-count" style={{ display: 'block', marginBottom: 4, fontWeight: 'bold' }}>
              Guests:
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
            <strong>Selected:</strong> {halls?.find(h => h.id === selectedHallId)?.name} | {tableCategories?.find(tc => tc.id === selectedTableCategoryId)?.name} | {guestCount} guests
          </div>
        )}
      </section>

      {menuLoading ? <p>Loading menu...</p> : null}
      {menuError ? <p>Failed to load menu.</p> : null}

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
        <h3>Real-time estimate</h3>
        <p>Subtotal: ${(pricing.subtotalCents / 100).toFixed(2)}</p>
        <p>Service fee: ${(pricing.serviceFeeCents / 100).toFixed(2)}</p>
        <p>Tax: ${(pricing.taxCents / 100).toFixed(2)}</p>
        <strong>Total: ${(pricing.totalCents / 100).toFixed(2)}</strong>
        {guestCount > 1 && (
          <p>Per guest: ${(pricing.perGuestCents / 100).toFixed(2)}</p>
        )}
      </section>
    </main>
  );
};
