import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { restaurantService } from '../services/restaurant.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
const formatError = (error) => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data;
        if (typeof body?.message === 'string')
            return body.message;
    }
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
};
const DEFAULT_LOGO = 'https://placehold.co/80x80?text=🍽️';
export const AdminRestaurantsPage = () => {
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [formError, setFormError] = useState(null);
    const [editing, setEditing] = useState(null);
    const [editError, setEditError] = useState(null);
    const { data: restaurants = [], isLoading, isError } = useQuery({
        queryKey: ['restaurants'],
        queryFn: () => restaurantService.list()
    });
    const createMutation = useMutation({
        mutationFn: () => restaurantService.create({
            name: name.trim(),
            address: address.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined
        }),
        onSuccess: () => {
            setName('');
            setAddress('');
            setLogoUrl('');
            setFormError(null);
            queryClient.invalidateQueries({ queryKey: ['restaurants'] });
        },
        onError: (e) => setFormError(formatError(e))
    });
    const updateMutation = useMutation({
        mutationFn: () => restaurantService.update(editing.id, {
            name: editing.name.trim(),
            address: editing.address.trim() || undefined,
            logoUrl: editing.logoUrl.trim() || undefined
        }),
        onSuccess: () => {
            setEditing(null);
            setEditError(null);
            queryClient.invalidateQueries({ queryKey: ['restaurants'] });
        },
        onError: (e) => setEditError(formatError(e))
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => restaurantService.remove(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['restaurants'] })
    });
    const inputStyle = {
        background: 'rgba(15,23,42,0.6)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        color: '#e2e8f0',
        padding: '0.6rem 0.9rem',
        width: '100%',
        fontSize: 14,
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.18s, background 0.18s',
    };
    const labelStyle = { display: 'grid', gap: 4 };
    const labelTextStyle = { fontSize: 12, fontWeight: 500, color: '#374151' };
    return (_jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 880, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsx("h1", { className: "adm-title", style: { marginBottom: 24 }, children: t('restaurants_management') }), _jsxs("section", { className: "adm-card tablet-fade-up adm-section", style: { marginBottom: 28 }, children: [_jsx("h2", { className: "adm-heading", style: { marginTop: 0, marginBottom: 16 }, children: t('create_restaurant') }), _jsxs("div", { className: "form-grid-2", children: [_jsxs("label", { style: labelStyle, children: [_jsxs("span", { style: labelTextStyle, children: [t('restaurant_name'), " *"] }), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: t('restaurant_name_placeholder'), style: inputStyle })] }), _jsxs("label", { style: labelStyle, children: [_jsx("span", { style: labelTextStyle, children: t('restaurant_address') }), _jsx("input", { value: address, onChange: (e) => setAddress(e.target.value), placeholder: t('restaurant_address_placeholder'), style: inputStyle })] }), _jsxs("label", { style: { ...labelStyle, gridColumn: '1 / -1' }, children: [_jsx("span", { style: labelTextStyle, children: t('restaurant_logo_url') }), _jsx("input", { value: logoUrl, onChange: (e) => setLogoUrl(e.target.value), placeholder: "https://example.com/logo.png", style: inputStyle })] })] }), _jsxs("div", { style: { marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { className: "adm-btn-primary", onClick: () => { setFormError(null); createMutation.mutate(); }, disabled: createMutation.isPending || !name.trim(), children: createMutation.isPending ? t('creating') : t('create') }), formError && (_jsx("span", { style: { color: '#dc2626', fontSize: 13 }, children: formError }))] })] }), isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.55)' }, children: t('loading_restaurants') }), isError && _jsx("p", { style: { color: '#fca5a5' }, children: t('failed_load_restaurants') }), !isLoading && restaurants.length === 0 && (_jsx("p", { className: "adm-empty", children: t('no_restaurants_yet') })), _jsx("div", { style: { display: 'grid', gap: 14 }, children: restaurants.map((r, idx) => (_jsx("div", { className: "adm-card adm-card-hover tablet-fade-up", style: { overflow: 'hidden', animationDelay: `${idx * 60}ms` }, children: editing?.id === r.id ? (_jsxs("div", { style: { padding: 20 }, children: [_jsxs("div", { className: "form-grid-2", children: [_jsxs("label", { style: labelStyle, children: [_jsxs("span", { style: labelTextStyle, children: [t('restaurant_name'), " *"] }), _jsx("input", { value: editing.name, onChange: (e) => setEditing({ ...editing, name: e.target.value }), style: inputStyle })] }), _jsxs("label", { style: labelStyle, children: [_jsx("span", { style: labelTextStyle, children: t('restaurant_address') }), _jsx("input", { value: editing.address, onChange: (e) => setEditing({ ...editing, address: e.target.value }), style: inputStyle })] }), _jsxs("label", { style: { ...labelStyle, gridColumn: '1 / -1' }, children: [_jsx("span", { style: labelTextStyle, children: t('restaurant_logo_url') }), _jsx("input", { value: editing.logoUrl, onChange: (e) => setEditing({ ...editing, logoUrl: e.target.value }), style: inputStyle })] })] }), _jsxs("div", { style: { marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("button", { onClick: () => { setEditError(null); updateMutation.mutate(); }, disabled: updateMutation.isPending || !editing.name.trim(), style: { padding: '6px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }, children: updateMutation.isPending ? t('saving') : t('save') }), _jsx("button", { onClick: () => { setEditing(null); setEditError(null); }, style: { padding: '6px 16px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }, children: t('cancel') }), editError && _jsx("span", { style: { color: '#dc2626', fontSize: 13 }, children: editError })] })] })) : (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 16, padding: 16, flexWrap: 'wrap' }, children: [_jsx("img", { src: getPhotoUrl(r.logoUrl) || DEFAULT_LOGO, alt: r.name, style: { width: 72, height: 72, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#f3f4f6' }, onError: (e) => { e.currentTarget.src = DEFAULT_LOGO; } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { fontWeight: 700, fontSize: 16, margin: 0 }, children: r.name }), r.address && (_jsx("p", { style: { color: '#6b7280', fontSize: 13, margin: '2px 0 0' }, children: r.address }))] }), _jsxs("div", { style: { display: 'flex', gap: 8, flexShrink: 0 }, children: [_jsx("button", { onClick: () => setEditing({ id: r.id, name: r.name, address: r.address ?? '', logoUrl: r.logoUrl ?? '' }), style: { padding: '6px 14px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer' }, children: t('edit') }), _jsx("button", { onClick: () => {
                                            if (window.confirm(t('confirm_delete_restaurant'))) {
                                                deleteMutation.mutate(r.id);
                                            }
                                        }, disabled: deleteMutation.isPending, style: { padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }, children: t('delete') })] })] })) }, r.id))) })] }));
};
