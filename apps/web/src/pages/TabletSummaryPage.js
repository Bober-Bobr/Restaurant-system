import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePriceCalculator } from '../hooks/usePriceCalculator';
import { publicMenuService } from '../services/publicMenu.service';
import { publicHallService } from '../services/publicHall.service';
import { publicTableCategoryService } from '../services/publicTableCategory.service';
import { useTabletStore } from '../store/tablet.store';
import { httpClient } from '../services/http';
import logo from '../assets/logo.png';
export const TabletSummaryPage = () => {
    const navigate = useNavigate();
    const { selectedItems, selectedHallId, selectedTableCategoryId, guestCount } = useTabletStore();
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const { data: menuItems } = useQuery({
        queryKey: ['menu-items', 'public'],
        queryFn: () => publicMenuService.listActive()
    });
    const { data: halls } = useQuery({
        queryKey: ['halls', 'public'],
        queryFn: () => publicHallService.listActive()
    });
    const { data: tableCategories } = useQuery({
        queryKey: ['table-categories', 'public'],
        queryFn: () => publicTableCategoryService.listActive()
    });
    const selectedTableCategory = tableCategories?.find(tc => tc.id === selectedTableCategoryId);
    const selectedHall = halls?.find(h => h.id === selectedHallId);
    const selectedMenuItems = menuItems?.filter(item => selectedItems[item.id] > 0) || [];
    const pricing = usePriceCalculator(menuItems ?? [], selectedItems, selectedTableCategory, guestCount);
    const confirmMutation = useMutation({
        mutationFn: async () => {
            // For now, just log; in real app, create event via API
            console.log('Confirming event:', {
                customerName,
                customerPhone,
                selectedHallId,
                selectedTableCategoryId,
                guestCount,
                selectedItems
            });
            // Simulate creating event and getting ID
            return { eventId: '123' }; // Mock
        },
        onSuccess: (data) => {
            alert('Event confirmed! Event ID: ' + data.eventId);
            // Enable downloads with eventId
        }
    });
    const downloadPdf = async () => {
        try {
            const response = await httpClient.post('/public/export/pdf', {
                customerName,
                customerPhone,
                hallName: selectedHall?.name || '',
                tableCategoryName: selectedTableCategory?.name || '',
                guestCount,
                selectedItems,
                menuItems: menuItems || [],
                pricing
            }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'selection-summary.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
        catch (error) {
            alert('Failed to download PDF');
        }
    };
    const downloadExcel = async () => {
        try {
            const response = await httpClient.post('/public/export/excel', {
                customerName,
                customerPhone,
                hallName: selectedHall?.name || '',
                tableCategoryName: selectedTableCategory?.name || '',
                guestCount,
                selectedItems,
                menuItems: menuItems || [],
                pricing
            }, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'selection-summary.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
        catch (error) {
            alert('Failed to download Excel');
        }
    };
    return (_jsxs("main", { style: { padding: 20, maxWidth: 800, margin: '0 auto' }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("img", { src: logo, alt: "Restaurant logo", style: { width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' } }), _jsx("h1", { children: "Selection Summary" })] }), _jsxs("div", { style: { display: 'grid', gap: 24 }, children: [_jsxs("section", { style: { padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }, children: [_jsx("h2", { children: "Customer Details" }), _jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsxs("label", { children: [_jsx("span", { style: { display: 'block', marginBottom: 4, fontWeight: 'bold' }, children: "Name:" }), _jsx("input", { type: "text", value: customerName, onChange: (e) => setCustomerName(e.target.value), placeholder: "Enter your name", style: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' } })] }), _jsxs("label", { children: [_jsx("span", { style: { display: 'block', marginBottom: 4, fontWeight: 'bold' }, children: "Phone:" }), _jsx("input", { type: "tel", value: customerPhone, onChange: (e) => setCustomerPhone(e.target.value), placeholder: "Enter your phone number", style: { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' } })] })] })] }), _jsxs("section", { style: { padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }, children: [_jsx("h2", { children: "Event Details" }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsxs("p", { children: [_jsx("strong", { children: "Hall:" }), " ", selectedHall?.name || 'Not selected'] }), _jsxs("p", { children: [_jsx("strong", { children: "Table Category:" }), " ", selectedTableCategory?.name || 'Not selected'] }), _jsxs("p", { children: [_jsx("strong", { children: "Guest Count:" }), " ", guestCount] })] })] }), _jsxs("section", { style: { padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }, children: [_jsx("h2", { children: "Selected Dishes" }), selectedMenuItems.length === 0 ? (_jsx("p", { children: "No items selected." })) : (_jsx("ul", { style: { listStyle: 'none', padding: 0 }, children: selectedMenuItems.map((item) => (_jsxs("li", { style: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }, children: [_jsxs("span", { children: [item.name, " (x", selectedItems[item.id], ")"] }), _jsxs("span", { children: ["$", ((item.priceCents * selectedItems[item.id]) / 100).toFixed(2)] })] }, item.id))) }))] }), _jsxs("section", { style: { padding: 20, border: '1px solid #ddd', borderRadius: 8, backgroundColor: '#fafafa' }, children: [_jsx("h2", { children: "Pricing" }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsxs("p", { children: ["Subtotal: $", (pricing.subtotalCents / 100).toFixed(2)] }), _jsxs("p", { children: ["Service Fee: $", (pricing.serviceFeeCents / 100).toFixed(2)] }), _jsxs("p", { children: ["Tax: $", (pricing.taxCents / 100).toFixed(2)] }), _jsx("p", { children: _jsxs("strong", { children: ["Total: $", (pricing.totalCents / 100).toFixed(2)] }) }), guestCount > 1 && (_jsxs("p", { children: ["Price per Person: $", (pricing.perGuestCents / 100).toFixed(2)] }))] })] }), _jsxs("div", { style: { display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { onClick: () => navigate('/tablet'), style: { padding: '12px 24px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: "Edit Selection" }), _jsx("button", { onClick: () => confirmMutation.mutate(), disabled: confirmMutation.isPending || !customerName || !customerPhone, style: { padding: '12px 24px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: confirmMutation.isPending || !customerName || !customerPhone ? 0.5 : 1 }, children: confirmMutation.isPending ? 'Confirming...' : 'Confirm' }), _jsx("button", { onClick: downloadPdf, style: { padding: '12px 24px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: "Download PDF" }), _jsx("button", { onClick: downloadExcel, style: { padding: '12px 24px', backgroundColor: '#9C27B0', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: "Download Excel" })] })] })] }));
};
