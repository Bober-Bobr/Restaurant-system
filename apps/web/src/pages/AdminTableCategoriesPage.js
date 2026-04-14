import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
const FOOD_PACKAGE_OPTIONS = [
    'COLD_APPETIZERS',
    'SALADS',
    'DRINKS',
    'SWEETS',
    'FRUITS',
];
const parseCats = (raw) => raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => FOOD_PACKAGE_OPTIONS.includes(s));
const serializeCats = (cats) => cats.join(',');
function FoodPackageCheckboxes({ selected, onChange, locale, }) {
    const t = (key) => translate(key, locale);
    const toggle = (cat) => {
        if (selected.includes(cat)) {
            onChange(selected.filter((c) => c !== cat));
        }
        else {
            onChange([...selected, cat]);
        }
    };
    const labels = {
        COLD_APPETIZERS: 'cold_appetizers',
        SALADS: 'salads',
        DRINKS: 'drinks',
        SWEETS: 'sweets',
        FRUITS: 'fruits',
    };
    return (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 10 }, children: FOOD_PACKAGE_OPTIONS.map((cat) => (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9em' }, children: [_jsx("input", { type: "checkbox", checked: selected.includes(cat), onChange: () => toggle(cat) }), t(labels[cat])] }, cat))) }));
}
export const AdminTableCategoriesPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const { data: categories, isLoading, isError } = useQuery({
        queryKey: ['tableCategories'],
        queryFn: () => tableCategoryService.list(),
    });
    // Create form state
    const [name, setName] = useState('');
    const [selectedCats, setSelectedCats] = useState([]);
    const [ratePerPersonText, setRatePerPersonText] = useState('0');
    const [description, setDescription] = useState('');
    const [photoUrl, setPhotoUrl] = useState('');
    // Edit state
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editSelectedCats, setEditSelectedCats] = useState([]);
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
        const ratePerPerson = Number(ratePerPersonText);
        if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0)
            errors.push('Rate per person must be a non-negative number.');
        return { errors };
    }, [name, ratePerPersonText]);
    const editValidation = useMemo(() => {
        const errors = [];
        if (editName.trim().length < 1)
            errors.push('Name is required.');
        if (editName.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const ratePerPerson = Number(editRatePerPersonText);
        if (!Number.isFinite(ratePerPerson) || ratePerPerson < 0)
            errors.push('Rate per person must be a non-negative number.');
        return { errors };
    }, [editName, editRatePerPersonText]);
    const createMutation = useMutation({
        mutationFn: () => {
            if (validation.errors.length > 0)
                throw new Error(validation.errors[0]);
            return tableCategoryService.create({
                name: name.trim(),
                includedCategories: serializeCats(selectedCats),
                ratePerPerson: Math.round(Number(ratePerPersonText) * 100),
                description: description.trim() || undefined,
                photoUrl: photoUrl.trim() || undefined,
                isActive: true,
            });
        },
        onSuccess: async () => {
            setName('');
            setSelectedCats([]);
            setRatePerPersonText('0');
            setDescription('');
            setPhotoUrl('');
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        },
    });
    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => tableCategoryService.update(id, data),
        onSuccess: async () => {
            setEditingId(null);
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => tableCategoryService.remove(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['tableCategories'] });
        },
    });
    const startEditing = (category) => {
        setEditingId(category.id);
        setEditName(category.name);
        setEditSelectedCats(parseCats(category.includedCategories));
        setEditRatePerPersonText((category.ratePerPerson / 100).toFixed(2));
        setEditDescription(category.description || '');
        setEditPhotoUrl(category.photoUrl || '');
        setEditIsActive(category.isActive);
    };
    const saveEdit = () => {
        if (!editingId || editValidation.errors.length > 0)
            return;
        updateMutation.mutate({
            id: editingId,
            data: {
                name: editName.trim(),
                includedCategories: serializeCats(editSelectedCats),
                ratePerPerson: Math.round(Number(editRatePerPersonText) * 100),
                description: editDescription.trim() || undefined,
                photoUrl: editPhotoUrl.trim() || undefined,
                isActive: editIsActive,
            },
        });
    };
    const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
    const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: t('table_categories_management') }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: t('create_table_category') }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); if (!canSubmit)
                            return; createMutation.mutate(); }, style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('name'), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: t('table_category_name_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('rate_per_person'), _jsx(Input, { value: ratePerPersonText, onChange: (e) => setRatePerPersonText(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: '0.9em', fontWeight: 500 }, children: t('food_package') }), _jsx(FoodPackageCheckboxes, { selected: selectedCats, onChange: setSelectedCats, locale: locale })] }), _jsx("div", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: _jsx(PhotoSelector, { category: "table", selectedPhotoUrl: photoUrl || undefined, onPhotoSelect: (url) => setPhotoUrl(url || ''), placeholder: t('select_table_photo') }) }), _jsxs("label", { style: { display: 'grid', gap: 6, gridColumn: '1 / -1' }, children: [t('description_optional'), _jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx(Button, { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? t('creating') : t('create_category') }), validation.errors.length > 0 && (_jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] })), createMutation.isError && (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category') }))] })] })] }), isLoading && _jsx("p", { children: t('loading_table_categories') }), isError && _jsx("p", { children: t('failed_to_load_table_categories') }), categories && (_jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12 }, children: [_jsx("h3", { children: t('all_categories') }), categories.length === 0 ? (_jsx("p", { children: t('no_table_categories_yet') })) : (_jsx("div", { style: { display: 'grid', gap: 12 }, children: categories.map((category) => (_jsx("div", { style: { border: '1px solid #eee', padding: 12, borderRadius: 4 }, children: editingId === category.id ? (_jsxs("div", { children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end', marginBottom: 12 }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('name'), _jsx(Input, { value: editName, onChange: (e) => setEditName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('rate_dollar'), _jsx(Input, { value: editRatePerPersonText, onChange: (e) => setEditRatePerPersonText(e.target.value) })] })] }), _jsxs("div", { style: { marginBottom: 12, display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: '0.9em', fontWeight: 500 }, children: t('food_package') }), _jsx(FoodPackageCheckboxes, { selected: editSelectedCats, onChange: setEditSelectedCats, locale: locale })] }), _jsx("div", { style: { marginBottom: 12 }, children: _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('description'), _jsx(Input, { value: editDescription, onChange: (e) => setEditDescription(e.target.value) })] }) }), _jsx("div", { style: { marginBottom: 12 }, children: _jsx(PhotoSelector, { category: "table", selectedPhotoUrl: editPhotoUrl || undefined, onPhotoSelect: (url) => setEditPhotoUrl(url || ''), placeholder: t('select_table_photo') }) }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.9em' }, children: [_jsx("input", { type: "checkbox", checked: editIsActive, onChange: (e) => setEditIsActive(e.target.checked) }), t('active')] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(Button, { onClick: saveEdit, disabled: !canSaveEdit, children: updateMutation.isPending ? t('saving') : t('save') }), _jsx(Button, { variant: "secondary", onClick: () => setEditingId(null), children: t('cancel') })] }), editValidation.errors.length > 0 && (_jsx("div", { style: { color: '#b00020', fontSize: '0.9em', marginTop: 6 }, children: editValidation.errors[0] }))] })) : (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [category.photoUrl && (_jsx("img", { src: getPhotoUrl(category.photoUrl), alt: category.name, style: { width: 80, height: 60, objectFit: 'cover', borderRadius: 4 } })), _jsxs("div", { children: [_jsx("strong", { children: category.name }), _jsxs("p", { style: { margin: '4px 0 0', fontSize: '0.9em', color: '#666' }, children: [t('rate'), ": $", (category.ratePerPerson / 100).toFixed(2), category.includedCategories
                                                                ? ` • ${parseCats(category.includedCategories)
                                                                    .map((c) => translate(c.toLowerCase(), locale))
                                                                    .join(', ')}`
                                                                : '', category.description ? ` — ${category.description}` : '', !category.isActive && ` (${t('inactive')})`] })] })] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx("button", { onClick: () => startEditing(category), style: { background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: t('edit') }), _jsx("button", { onClick: () => deleteMutation.mutate(category.id), disabled: deleteMutation.isPending, style: { background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4 }, children: t('delete') })] })] })) }, category.id))) }))] }))] }));
};
