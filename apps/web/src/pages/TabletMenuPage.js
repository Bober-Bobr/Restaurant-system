import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("img", { src: logo, alt: "Restaurant logo", style: { width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' } }), _jsx("h1", { children: "Client Menu Selection" })] }), _jsxs("section", { style: { marginBottom: 20, padding: 16, border: '1px solid #ddd', borderRadius: 8 }, children: [_jsx("h3", { children: "Room & Table Settings" }), _jsxs("div", { style: { display: 'flex', gap: 16, marginBottom: 12, alignItems: 'end' }, children: [_jsxs("div", { style: { flex: 1 }, children: [_jsx("label", { htmlFor: "hall-select", style: { display: 'block', marginBottom: 4, fontWeight: 'bold' }, children: "Select Room:" }), _jsxs("select", { id: "hall-select", value: selectedHallId || '', onChange: (e) => setHall(e.target.value), style: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }, disabled: hallsLoading, children: [_jsx("option", { value: "", children: "Choose a room..." }), (halls ?? []).filter(h => h.isActive).map((hall) => (_jsxs("option", { value: hall.id, children: [hall.name, " (Capacity: ", hall.capacity, ")"] }, hall.id)))] })] }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("label", { htmlFor: "table-select", style: { display: 'block', marginBottom: 4, fontWeight: 'bold' }, children: "Select Table Category:" }), _jsxs("select", { id: "table-select", value: selectedTableCategoryId || '', onChange: (e) => setTableCategory(e.target.value), style: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }, disabled: tableCategoriesLoading, children: [_jsx("option", { value: "", children: "Choose a table category..." }), (tableCategories ?? []).filter(tc => tc.isActive).map((tableCategory) => (_jsxs("option", { value: tableCategory.id, children: [tableCategory.name, " - ", tableCategory.mealPackage, " ($", (tableCategory.ratePerPerson / 100).toFixed(2), "/person)"] }, tableCategory.id)))] })] }), _jsxs("div", { style: { width: 120 }, children: [_jsx("label", { htmlFor: "guest-count", style: { display: 'block', marginBottom: 4, fontWeight: 'bold' }, children: "Guests:" }), _jsx("input", { id: "guest-count", type: "number", min: "1", value: guestCount, onChange: (e) => setGuestCount(parseInt(e.target.value) || 1), style: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' } })] })] }), selectedHallId && selectedTableCategoryId && (_jsxs("div", { style: { padding: 8, backgroundColor: '#f0f8ff', borderRadius: 4 }, children: [_jsx("strong", { children: "Selected:" }), " ", halls?.find(h => h.id === selectedHallId)?.name, " | ", tableCategories?.find(tc => tc.id === selectedTableCategoryId)?.name, " | ", guestCount, " guests"] }))] }), menuLoading ? _jsx("p", { children: "Loading menu..." }) : null, menuError ? _jsx("p", { children: "Failed to load menu." }) : null, _jsx("section", { style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))',
                    gap: 12,
                    marginBottom: 20
                }, children: (menuItems ?? []).map((item) => (_jsx(MenuItemCard, { item: item, quantity: selectedItems[item.id] ?? 0, onQuantityChange: (nextQuantity) => setQuantity(item.id, nextQuantity) }, item.id))) }), _jsxs("section", { style: { borderTop: '1px solid #ddd', paddingTop: 12 }, children: [_jsx("h3", { children: "Real-time estimate" }), _jsxs("p", { children: ["Subtotal: $", (pricing.subtotalCents / 100).toFixed(2)] }), _jsxs("p", { children: ["Service fee: $", (pricing.serviceFeeCents / 100).toFixed(2)] }), _jsxs("p", { children: ["Tax: $", (pricing.taxCents / 100).toFixed(2)] }), _jsxs("strong", { children: ["Total: $", (pricing.totalCents / 100).toFixed(2)] }), guestCount > 1 && (_jsxs("p", { children: ["Per guest: $", (pricing.perGuestCents / 100).toFixed(2)] }))] })] }));
};
