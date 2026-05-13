import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { hallService } from '../services/hall.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
const parsePositiveInt = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0)
        return null;
    return parsed;
};
export const AdminHallsPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const { data: halls, isLoading, isError } = useQuery({
        queryKey: ['halls'],
        queryFn: () => hallService.list()
    });
    const [name, setName] = useState('');
    const [capacityText, setCapacityText] = useState('100');
    const [description, setDescription] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editCapacityText, setEditCapacityText] = useState('100');
    const [editDescription, setEditDescription] = useState('');
    const [editPhotoUrl, setEditPhotoUrl] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const validation = useMemo(() => {
        const errors = [];
        if (name.trim().length < 1)
            errors.push('Name is required.');
        if (name.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const capacity = parsePositiveInt(capacityText);
        if (capacity === null)
            errors.push('Capacity must be a positive integer.');
        if (capacity !== null && capacity > 5000)
            errors.push('Capacity must be 5000 or less.');
        return { errors, capacity };
    }, [name, capacityText]);
    const editValidation = useMemo(() => {
        const errors = [];
        if (editName.trim().length < 1)
            errors.push('Name is required.');
        if (editName.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const capacity = parsePositiveInt(editCapacityText);
        if (capacity === null)
            errors.push('Capacity must be a positive integer.');
        if (capacity !== null && capacity > 5000)
            errors.push('Capacity must be 5000 or less.');
        return { errors, capacity };
    }, [editName, editCapacityText]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0 || validation.capacity === null) {
                throw new Error(validation.errors[0] ?? 'Invalid form');
            }
            return hallService.create({
                name: name.trim(),
                capacity: validation.capacity,
                description: description.trim() ? description.trim() : undefined,
                photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
                isActive: true
            });
        },
        onSuccess: async () => {
            setName('');
            setCapacityText('100');
            setDescription('');
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => hallService.update(id, data),
        onSuccess: async () => {
            setEditingId(null);
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => hallService.remove(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['halls'] });
        }
    });
    const startEditing = (hall) => {
        setEditingId(hall.id);
        setEditName(hall.name);
        setEditCapacityText(hall.capacity.toString());
        setEditDescription(hall.description || '');
        setEditPhotoUrl(hall.photoUrl || '');
        setEditIsActive(hall.isActive);
    };
    const saveEdit = () => {
        if (!editingId || editValidation.errors.length > 0 || editValidation.capacity === null)
            return;
        updateMutation.mutate({
            id: editingId,
            data: {
                name: editName.trim(),
                capacity: editValidation.capacity,
                description: editDescription.trim() || undefined,
                photoUrl: editPhotoUrl.trim() ? editPhotoUrl.trim() : undefined,
                isActive: editIsActive
            }
        });
    };
    const cancelEdit = () => {
        setEditingId(null);
    };
    const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
    const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;
    return (_jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsx("h1", { className: "adm-title", style: { marginBottom: 20 }, children: t('halls_management') }), _jsxs("section", { className: "adm-card tablet-fade-up adm-section", children: [_jsx("h3", { className: "adm-heading", style: { marginTop: 0, marginBottom: 16 }, children: t('create_hall') }), _jsxs("form", { onSubmit: (event) => {
                            event.preventDefault();
                            if (!canSubmit || createMutation.isPending)
                                return;
                            createMutation.mutate();
                        }, className: "form-grid-2", style: { alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('name'), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: t('hall_name_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('hall_capacity'), _jsx(Input, { type: "number", min: 1, max: 5000, inputMode: "numeric", value: capacityText, onChange: (e) => setCapacityText(e.target.value) })] }), _jsx("div", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: _jsx(PhotoSelector, { category: "hall", selectedPhotoUrl: photoUrl || undefined, onPhotoSelect: (url) => setPhotoUrl(url || ''), placeholder: t('select_hall_photo') }) }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('description_optional'), _jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx(Button, { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? t('creating') : t('create_hall_button') }), validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_hall') })) : null] })] })] }), isLoading ? _jsx("p", { children: t('loading_halls') }) : null, isError ? _jsx("p", { children: t('failed_to_load_halls') }) : null, halls && (_jsxs("section", { className: "adm-card tablet-fade-up adm-section", style: { animationDelay: '80ms' }, children: [_jsx("h3", { className: "adm-heading", style: { marginTop: 0, marginBottom: 16 }, children: t('all_halls') }), halls.length === 0 ? (_jsx("p", { className: "adm-empty", children: t('no_halls_yet') })) : (_jsx("div", { style: { display: 'grid', gap: 10 }, children: halls.map((hall, idx) => (_jsx("div", { className: "adm-card adm-card-hover tablet-fade-up", style: {
                                padding: 14,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                animationDelay: `${idx * 50}ms`,
                            }, children: editingId === hall.id ? (_jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { className: "form-grid-4", style: { alignItems: 'end', marginBottom: 12 }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('name'), _jsx(Input, { value: editName, onChange: (e) => setEditName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('hall_capacity'), _jsx(Input, { type: "number", min: 1, max: 5000, value: editCapacityText, onChange: (e) => setEditCapacityText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('hall_description'), _jsx(Input, { value: editDescription, onChange: (e) => setEditDescription(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('hall_active'), _jsx("input", { type: "checkbox", checked: editIsActive, onChange: (e) => setEditIsActive(e.target.checked) })] })] }), _jsx("div", { style: { marginBottom: 12 }, children: _jsx(PhotoSelector, { category: "hall", selectedPhotoUrl: editPhotoUrl || undefined, onPhotoSelect: (url) => setEditPhotoUrl(url || ''), placeholder: t('select_hall_photo') }) }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(Button, { onClick: saveEdit, disabled: !canSaveEdit, children: updateMutation.isPending ? t('saving') : t('save') }), _jsx(Button, { variant: "secondary", onClick: cancelEdit, children: t('cancel') })] }), editValidation.errors.length > 0 && (_jsx("div", { style: { gridColumn: '1 / -1', color: '#b00020', fontSize: '0.9em' }, children: editValidation.errors[0] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [hall.photoUrl ? (_jsx("img", { src: getPhotoUrl(hall.photoUrl), alt: hall.name, style: { width: 80, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' } })) : null, _jsxs("div", { children: [_jsx("strong", { style: { color: '#f8fafc', fontSize: 15 }, children: hall.name }), _jsxs("p", { style: { margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.6)' }, children: [t('hall_capacity'), ": ", _jsx("span", { style: { color: '#c9a42c', fontWeight: 600 }, children: hall.capacity }), hall.description ? _jsxs("span", { style: { color: 'rgba(226,232,240,0.45)' }, children: [" \u00B7 ", hall.description] }) : '', !hall.isActive && _jsxs("span", { style: { color: '#fca5a5' }, children: [" (", t('hall_inactive'), ")"] })] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsxs("button", { onClick: () => startEditing(hall), className: "adm-btn-ghost", style: { fontSize: 12, padding: '5px 12px', color: '#c9a42c', borderColor: 'rgba(201,164,44,0.35)', display: 'inline-flex', alignItems: 'center', gap: 4 }, children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }), t('edit')] }), _jsxs("button", { onClick: () => deleteMutation.mutate(hall.id), disabled: deleteMutation.isPending, className: "adm-btn-danger", style: { fontSize: 12, padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }, children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "3 6 5 6 21 6" }), _jsx("path", { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }), _jsx("path", { d: "M10 11v6M14 11v6" })] }), t('delete')] })] })] })) }, hall.id))) }))] }))] }));
};
