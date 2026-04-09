import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const parsePriceToCents = (value) => {
    const normalized = value.replace(',', '.').trim();
    if (!normalized)
        return null;
    const amount = Number(normalized);
    if (!Number.isFinite(amount) || amount <= 0)
        return null;
    return Math.round(amount * 100);
};
const formatCents = (cents) => (cents / 100).toFixed(2);
export const AdminMenuPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const { data, isLoading, isError } = useQuery({
        queryKey: ['menu-items', 'admin', 'all'],
        queryFn: () => menuService.listAllForAdmin()
    });
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('HOT_APPETIZERS');
    const [price, setPrice] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    const createMutation = useMutation({
        mutationFn: async () => {
            const priceCents = parsePriceToCents(price);
            if (priceCents === null) {
                throw new Error('Invalid price');
            }
            return menuService.create({
                name: name.trim(),
                description: description.trim() ? description.trim() : undefined,
                category,
                priceCents,
                photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined
            });
        },
        onSuccess: async () => {
            setName('');
            setDescription('');
            setCategory('HOT_APPETIZERS');
            setPrice('');
            setPhotoUrl('');
            await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: async (args) => {
            return menuService.update(args.menuItemId, args.patch);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
            await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (menuItemId) => menuService.remove(menuItemId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['menu-items', 'admin', 'all'] });
            await queryClient.invalidateQueries({ queryKey: ['menu-items', 'public'] });
        }
    });
    const canCreate = useMemo(() => {
        if (name.trim().length < 2)
            return false;
        if (parsePriceToCents(price) === null)
            return false;
        return true;
    }, [name, price]);
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: translate('menu_management', locale) }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: translate('create_menu_item', locale) }), _jsxs("form", { onSubmit: (event) => {
                            event.preventDefault();
                            if (!canCreate || createMutation.isPending)
                                return;
                            createMutation.mutate();
                        }, style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('name', locale), _jsx("input", { value: name, onChange: (e) => setName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('category', locale), _jsxs("select", { value: category, onChange: (e) => setCategory(e.target.value), children: [_jsx("option", { value: "HOT_APPETIZERS", children: translate('hot_appetizers', locale) }), _jsx("option", { value: "FIRST_COURSE", children: translate('first_course', locale) }), _jsx("option", { value: "SECOND_COURSE", children: translate('second_course', locale) })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('price', locale), " (e.g. 6.50)", _jsx("input", { value: price, onChange: (e) => setPrice(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('photo_url', locale), " (optional)", _jsx("input", { value: photoUrl, onChange: (e) => setPhotoUrl(e.target.value), placeholder: "https://example.com/image.jpg" })] }), _jsxs("label", { style: { gridColumn: '1 / -1', display: 'grid', gap: 6 }, children: [translate('description', locale), _jsx("input", { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { type: "submit", disabled: !canCreate || createMutation.isPending, children: createMutation.isPending ? translate('creating', locale) : translate('create', locale) }), createMutation.isError ? _jsx("span", { style: { color: '#b00020' }, children: "Failed to create item." }) : null] })] })] }), isLoading ? _jsx("p", { children: translate('loading_menu', locale) }) : null, isError ? _jsx("p", { children: translate('failed_load_menu', locale) }) : null, _jsx("section", { style: { display: 'grid', gap: 8 }, children: (data ?? []).map((item) => (_jsx(MenuItemRow, { item: item, locale: locale, onPatch: (patch) => updateMutation.mutate({ menuItemId: item.id, patch }), isSaving: updateMutation.isPending, onDelete: () => deleteMutation.mutate(item.id), isDeleting: deleteMutation.isPending && deleteMutation.variables === item.id }, item.id))) })] }));
};
const MenuItemRow = ({ item, locale, onPatch, isSaving, onDelete, isDeleting }) => {
    const [localName, setLocalName] = useState(item.name);
    const [localCategory, setLocalCategory] = useState(item.category);
    const [localDescription, setLocalDescription] = useState(item.description ?? '');
    const [localPrice, setLocalPrice] = useState(formatCents(item.priceCents));
    const [localPhotoUrl, setLocalPhotoUrl] = useState(item.photoUrl ?? '');
    useEffect(() => {
        setLocalName(item.name);
        setLocalCategory(item.category);
        setLocalDescription(item.description ?? '');
        setLocalPrice(formatCents(item.priceCents));
        setLocalPhotoUrl(item.photoUrl ?? '');
    }, [item.category, item.description, item.name, item.priceCents, item.photoUrl]);
    return (_jsxs("article", { style: { border: '1px solid #eee', borderRadius: 8, padding: 12 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 100px', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('name', locale), _jsx("input", { value: localName, onChange: (e) => setLocalName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('category', locale), _jsxs("select", { value: localCategory, onChange: (e) => setLocalCategory(e.target.value), children: [_jsx("option", { value: "HOT_APPETIZERS", children: translate('hot_appetizers', locale) }), _jsx("option", { value: "FIRST_COURSE", children: translate('first_course', locale) }), _jsx("option", { value: "SECOND_COURSE", children: translate('second_course', locale) })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('price', locale), _jsx("input", { value: localPrice, onChange: (e) => setLocalPrice(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [translate('photo_url', locale), _jsx("input", { value: localPhotoUrl, onChange: (e) => setLocalPhotoUrl(e.target.value), placeholder: "https://example.com/image.jpg" })] })] }), _jsxs("label", { style: { display: 'grid', gap: 6, marginTop: 10 }, children: [translate('description', locale), _jsx("input", { value: localDescription, onChange: (e) => setLocalDescription(e.target.value) })] }), _jsxs("div", { style: { marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsx("button", { type: "button", disabled: isSaving, onClick: () => {
                            const priceCents = parsePriceToCents(localPrice);
                            onPatch({
                                name: localName.trim(),
                                category: localCategory,
                                description: localDescription.trim() ? localDescription.trim() : undefined,
                                photoUrl: localPhotoUrl.trim() ? localPhotoUrl.trim() : undefined,
                                ...(priceCents !== null ? { priceCents } : {})
                            });
                        }, children: translate('update', locale) }), _jsx("button", { type: "button", disabled: isSaving || isDeleting, onClick: () => {
                            if (window.confirm(`Delete dish "${item.name}"? This removes it from all events.`)) {
                                onDelete();
                            }
                        }, children: isDeleting ? translate('deleting', locale) : translate('delete', locale) }), _jsxs("span", { style: { color: '#666' }, children: ["Current: $", formatCents(item.priceCents)] })] })] }));
};
