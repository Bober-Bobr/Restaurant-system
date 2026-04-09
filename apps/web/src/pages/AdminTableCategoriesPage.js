import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
const parsePositiveInt = (value) => {
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed <= 0)
        return null;
    return parsed;
};
export const AdminTableCategoriesPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const t = (key, params) => translate(key, locale, params);
    const { data: categories, isLoading, isError } = useQuery({
        queryKey: ['tableCategories'],
        queryFn: () => tableCategoryService.list()
    });
    const [name, setName] = useState('');
    const [seatingCapacityText, setSeatingCapacityText] = useState('2');
    const [mealPackage, setMealPackage] = useState('');
    const [ratePerPersonText, setRatePerPersonText] = useState('0');
    const [description, setDescription] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editSeatingCapacityText, setEditSeatingCapacityText] = useState('2');
    const [editMealPackage, setEditMealPackage] = useState('');
    const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
    const [editDescription, setEditDescription] = useState('');
    const [editPhotoUrl, setEditPhotoUrl] = useState('');
    const [editIsActive, setEditIsActive] = useState(true);
    const validation = useMemo(() => {
        const errors = [];
        if (name.trim().length < 1)
            errors.push('Name is required.');
        if (name.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const seatingCapacity = parsePositiveInt(seatingCapacityText);
        if (seatingCapacity === null)
            errors.push('Seating capacity must be a positive integer.');
        if (seatingCapacity !== null && seatingCapacity > 1000)
            errors.push('Seating capacity must be 1000 or less.');
        if (mealPackage.trim().length < 2)
            errors.push('Meal package must be at least 2 characters.');
        const ratePerPerson = Number(ratePerPersonText);
        if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0)
            errors.push('Rate per person must be a non-negative number.');
        return { errors, seatingCapacity };
    }, [name, seatingCapacityText, mealPackage, ratePerPersonText]);
    const editValidation = useMemo(() => {
        const errors = [];
        if (editName.trim().length < 1)
            errors.push('Name is required.');
        if (editName.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const seatingCapacity = parsePositiveInt(editSeatingCapacityText);
        if (seatingCapacity === null)
            errors.push('Seating capacity must be a positive integer.');
        if (seatingCapacity !== null && seatingCapacity > 1000)
            errors.push('Seating capacity must be 1000 or less.');
        if (editMealPackage.trim().length < 2)
            errors.push('Meal package must be at least 2 characters.');
        const ratePerPerson = Number(editRatePerPersonText);
        if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0)
            errors.push('Rate per person must be a non-negative number.');
        return { errors, seatingCapacity };
    }, [editName, editSeatingCapacityText, editMealPackage, editRatePerPersonText]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0 || validation.seatingCapacity === null) {
                throw new Error(validation.errors[0] ?? 'Invalid form');
            }
            return tableCategoryService.create({
                name: name.trim(),
                seatingCapacity: validation.seatingCapacity,
                mealPackage: mealPackage.trim(),
                ratePerPerson: Math.round(Number(ratePerPersonText) * 100),
                description: description.trim() ? description.trim() : undefined,
                photoUrl: photoUrl.trim() ? photoUrl.trim() : undefined,
                isActive: true
            });
        },
        onSuccess: async () => {
            setName('');
            setSeatingCapacityText('2');
            setMealPackage('');
            setRatePerPersonText('0');
            setDescription('');
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        }
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => tableCategoryService.update(id, data),
        onSuccess: async () => {
            setEditingId(null);
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => tableCategoryService.remove(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        }
    });
    const startEditing = (category) => {
        setEditingId(category.id);
        setEditName(category.name);
        setEditSeatingCapacityText(category.seatingCapacity.toString());
        setEditMealPackage(category.mealPackage);
        setEditRatePerPersonText((category.ratePerPerson / 100).toFixed(2));
        setEditDescription(category.description || '');
        setEditPhotoUrl(category.photoUrl || '');
        setEditIsActive(category.isActive);
    };
    const saveEdit = () => {
        if (!editingId || editValidation.errors.length > 0 || editValidation.seatingCapacity === null)
            return;
        updateMutation.mutate({
            id: editingId,
            data: {
                name: editName.trim(),
                seatingCapacity: editValidation.seatingCapacity,
                mealPackage: editMealPackage.trim(),
                ratePerPerson: Math.round(Number(editRatePerPersonText) * 100),
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
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: t('table_categories_management') }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: t('create_table_category') }), _jsxs("form", { onSubmit: (event) => {
                            event.preventDefault();
                            if (!canSubmit || createMutation.isPending)
                                return;
                            createMutation.mutate();
                        }, style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('name'), _jsx("input", { value: name, onChange: (e) => setName(e.target.value), placeholder: t('table_category_name_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('seating_capacity'), _jsx("input", { type: "number", min: 1, max: 1000, inputMode: "numeric", value: seatingCapacityText, onChange: (e) => setSeatingCapacityText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('meal_package'), _jsx("input", { value: mealPackage, onChange: (e) => setMealPackage(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('rate_per_person'), _jsx("input", { value: ratePerPersonText, onChange: (e) => setRatePerPersonText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('photo_url_optional'), _jsx("input", { value: photoUrl, onChange: (e) => setPhotoUrl(e.target.value), placeholder: t('photo_url_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('description_optional'), _jsx("input", { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("button", { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? t('creating') : t('create_category') }), validation.errors.length > 0 ? (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })) : null, createMutation.isError ? (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category') })) : null] })] })] }), isLoading ? _jsx("p", { children: t('loading_table_categories') }) : null, isError ? _jsx("p", { children: t('failed_to_load_table_categories') }) : null, categories && (_jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12 }, children: [_jsx("h3", { children: t('all_categories') }), categories.length === 0 ? (_jsx("p", { children: t('no_table_categories_yet') })) : (_jsx("div", { style: { display: 'grid', gap: 12 }, children: categories.map((category) => (_jsx("div", { style: {
                                border: '1px solid #eee',
                                padding: 12,
                                borderRadius: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }, children: editingId === category.id ? (_jsxs("div", { style: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('name'), _jsx("input", { value: editName, onChange: (e) => setEditName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('capacity'), _jsx("input", { type: "number", min: 1, max: 1000, value: editSeatingCapacityText, onChange: (e) => setEditSeatingCapacityText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('meal_package'), _jsx("input", { value: editMealPackage, onChange: (e) => setEditMealPackage(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('rate_dollar'), _jsx("input", { value: editRatePerPersonText, onChange: (e) => setEditRatePerPersonText(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('description'), _jsx("input", { value: editDescription, onChange: (e) => setEditDescription(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('photo_url'), _jsx("input", { value: editPhotoUrl, onChange: (e) => setEditPhotoUrl(e.target.value), placeholder: t('photo_url_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('active'), _jsx("input", { type: "checkbox", checked: editIsActive, onChange: (e) => setEditIsActive(e.target.checked) })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: saveEdit, disabled: !canSaveEdit, style: { background: '#007bff', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: updateMutation.isPending ? t('saving') : t('save') }), _jsx("button", { onClick: cancelEdit, style: { background: '#6c757d', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: t('cancel') })] }), editValidation.errors.length > 0 && (_jsx("div", { style: { gridColumn: '1 / -1', color: '#b00020', fontSize: '0.9em' }, children: editValidation.errors[0] }))] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [category.photoUrl ? (_jsx("img", { src: category.photoUrl, alt: category.name, style: { width: 80, height: 60, objectFit: 'cover', borderRadius: 4 } })) : null, _jsxs("div", { children: [_jsx("strong", { children: category.name }), _jsxs("p", { style: { margin: '4px 0 0', fontSize: '0.9em', color: '#666' }, children: [t('capacity'), ": ", category.seatingCapacity, ", ", t('meal'), ": ", category.mealPackage, ", ", t('rate'), ": $", (category.ratePerPerson / 100).toFixed(2), category.description ? ` - ${category.description}` : '', !category.isActive && ` (${t('inactive')})`] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => startEditing(category), style: { background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: t('edit') }), _jsx("button", { onClick: () => deleteMutation.mutate(category.id), disabled: deleteMutation.isPending, style: { background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: t('delete') })] })] })) }, category.id))) }))] }))] }));
};
