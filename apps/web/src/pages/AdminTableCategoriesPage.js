import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { tableCategoryService } from '../services/tableCategory.service';
import { menuService } from '../services/menu.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { PhotoSelector } from '../components/ui/photo-selector';
import { Lightbox } from '../components/ui/lightbox';
import { formatSum, formatSumInput, parseSumToTiyin } from '../utils/currency';
const FOOD_PACKAGE_CATEGORIES = [
    'COLD_APPETIZERS',
    'SALADS',
    'DRINKS',
    'SWEETS',
    'FRUITS',
];
const CATEGORY_LABEL_KEY = {
    COLD_APPETIZERS: 'cold_appetizers',
    HOT_APPETIZERS: 'hot_appetizers',
    SALADS: 'salads',
    FIRST_COURSE: 'first_course',
    SECOND_COURSE: 'second_course',
    DRINKS: 'drinks',
    SWEETS: 'sweets',
    FRUITS: 'fruits',
};
const parseCats = (raw) => raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => FOOD_PACKAGE_CATEGORIES.includes(s));
const serializeCats = (cats) => cats.join(',');
// ── Food package section ───────────────────────────────────────────────────
function FoodPackageSection({ selectedCats, onCatsChange, selectedItemIds, onItemIdsChange, allMenuItems, locale, }) {
    const t = (key) => translate(key, locale);
    const grouped = FOOD_PACKAGE_CATEGORIES.reduce((acc, cat) => {
        acc[cat] = allMenuItems.filter((item) => item.isActive && item.category === cat);
        return acc;
    }, {});
    const toggleCat = (cat) => {
        const catItemIds = grouped[cat].map((item) => item.id);
        if (selectedCats.includes(cat)) {
            onCatsChange(selectedCats.filter((c) => c !== cat));
            onItemIdsChange(selectedItemIds.filter((id) => !catItemIds.includes(id)));
        }
        else {
            onCatsChange([...selectedCats, cat]);
            const toAdd = catItemIds.filter((id) => !selectedItemIds.includes(id));
            onItemIdsChange([...selectedItemIds, ...toAdd]);
        }
    };
    const toggleItem = (id, cat) => {
        if (selectedItemIds.includes(id)) {
            const next = selectedItemIds.filter((i) => i !== id);
            onItemIdsChange(next);
            const remainsInCat = grouped[cat].some((item) => next.includes(item.id));
            if (!remainsInCat) {
                onCatsChange(selectedCats.filter((c) => c !== cat));
            }
        }
        else {
            onItemIdsChange([...selectedItemIds, id]);
            if (!selectedCats.includes(cat)) {
                onCatsChange([...selectedCats, cat]);
            }
        }
    };
    return (_jsxs("div", { style: { display: 'grid', gap: 12 }, children: [_jsx("span", { style: { fontSize: '0.9em', fontWeight: 600 }, children: t('food_package') }), FOOD_PACKAGE_CATEGORIES.map((cat) => (_jsxs("div", { style: { border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }, children: [_jsxs("label", { style: {
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px',
                            background: selectedCats.includes(cat) ? '#f0fdf4' : '#f8fafc',
                            cursor: 'pointer', fontWeight: 500, fontSize: '0.9em',
                            borderBottom: grouped[cat].length > 0 ? '1px solid #e2e8f0' : 'none',
                        }, children: [_jsx("input", { type: "checkbox", checked: selectedCats.includes(cat), onChange: () => toggleCat(cat) }), t(CATEGORY_LABEL_KEY[cat]), _jsxs("span", { style: { marginLeft: 'auto', fontSize: '0.8em', color: '#94a3b8', fontWeight: 400 }, children: [grouped[cat].length, " ", grouped[cat].length === 1 ? 'dish' : 'dishes'] })] }), grouped[cat].length > 0 && (_jsx("div", { style: { padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }, children: grouped[cat].map((item) => (_jsxs("label", { style: {
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '4px 10px', borderRadius: 20,
                                border: `1px solid ${selectedItemIds.includes(item.id) ? '#22c55e' : '#cbd5e1'}`,
                                background: selectedItemIds.includes(item.id) ? '#f0fdf4' : 'white',
                                cursor: 'pointer', fontSize: '0.85em', userSelect: 'none',
                                transition: 'all 0.15s',
                            }, children: [_jsx("input", { type: "checkbox", style: { display: 'none' }, checked: selectedItemIds.includes(item.id), onChange: () => toggleItem(item.id, cat) }), item.name, _jsx("span", { style: { color: '#94a3b8' }, children: formatSum(item.priceCents) })] }, item.id))) }))] }, cat)))] }));
}
// ── Multi-photo field ──────────────────────────────────────────────────────
function PhotosField({ photoUrls, onChange }) {
    const [adding, setAdding] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    return (_jsxs(_Fragment, { children: [lightboxSrc && _jsx(Lightbox, { src: lightboxSrc, onClose: () => setLightboxSrc(null) }), _jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsx("span", { style: { fontSize: '0.9em', fontWeight: 600 }, children: "Photos" }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, children: [photoUrls.map((url, i) => (_jsxs("div", { style: { position: 'relative' }, children: [_jsx("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(url) ?? null), style: { display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'pointer' }, children: _jsx("img", { src: getPhotoUrl(url), alt: "", style: { width: 72, height: 60, objectFit: 'cover', display: 'block' } }) }), _jsx("button", { type: "button", onClick: () => onChange(photoUrls.filter((_, j) => j !== i)), style: {
                                            position: 'absolute', top: -6, right: -6,
                                            width: 18, height: 18, borderRadius: '50%',
                                            background: '#b00020', color: 'white', border: 'none',
                                            cursor: 'pointer', fontSize: 11,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }, children: "\u00D7" })] }, i))), _jsx("button", { type: "button", onClick: () => setAdding((v) => !v), style: {
                                    width: 72, height: 60, borderRadius: 8,
                                    border: '2px dashed #cbd5e1', background: adding ? '#f8fafc' : 'white',
                                    cursor: 'pointer', fontSize: 22, color: '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }, title: "Add photo", children: "+" })] }), adding && (_jsx("div", { style: { border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }, children: _jsx(PhotoSelector, { category: "table", selectedPhotoUrl: undefined, onPhotoSelect: (url) => {
                                if (url && !photoUrls.includes(url))
                                    onChange([...photoUrls, url]);
                                setAdding(false);
                            } }) }))] })] }));
}
// ── Page ───────────────────────────────────────────────────────────────────
export const AdminTableCategoriesPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const t = (key) => translate(key, locale);
    const { data: categories, isLoading, isError } = useQuery({
        queryKey: ['tableCategories'],
        queryFn: () => tableCategoryService.list(),
    });
    const { data: allMenuItems = [] } = useQuery({
        queryKey: ['menu-items', 'admin', 'all'],
        queryFn: () => menuService.listAllForAdmin(),
    });
    // ── Create form state ──────────────────────────────────────────────────
    const [name, setName] = useState('');
    const [selectedCats, setSelectedCats] = useState([]);
    const [selectedItemIds, setSelectedItemIds] = useState([]);
    const [ratePerPersonText, setRatePerPersonText] = useState('0');
    const [description, setDescription] = useState('');
    const [photos, setPhotos] = useState([]);
    // ── Edit state ─────────────────────────────────────────────────────────
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editSelectedCats, setEditSelectedCats] = useState([]);
    const [editSelectedItemIds, setEditSelectedItemIds] = useState([]);
    const [editRatePerPersonText, setEditRatePerPersonText] = useState('0');
    const [editDescription, setEditDescription] = useState('');
    const [editPhotos, setEditPhotos] = useState([]);
    const [editIsActive, setEditIsActive] = useState(true);
    const validation = useMemo(() => {
        const errors = [];
        if (name.trim().length < 1)
            errors.push('Name is required.');
        if (name.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const rate = Number(ratePerPersonText);
        if (!Number.isFinite(rate) || rate < 0)
            errors.push('Rate per person must be a non-negative number.');
        return { errors };
    }, [name, ratePerPersonText]);
    const editValidation = useMemo(() => {
        const errors = [];
        if (editName.trim().length < 1)
            errors.push('Name is required.');
        if (editName.trim().length > 100)
            errors.push('Name must be 100 characters or less.');
        const rate = Number(editRatePerPersonText);
        if (!Number.isFinite(rate) || rate < 0)
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
                menuItemIds: selectedItemIds,
                ratePerPerson: parseSumToTiyin(ratePerPersonText) ?? 0,
                description: description.trim() || undefined,
                photos,
                isActive: true,
            });
        },
        onSuccess: async () => {
            setName('');
            setSelectedCats([]);
            setSelectedItemIds([]);
            setRatePerPersonText('0');
            setDescription('');
            setPhotos([]);
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
        setEditSelectedItemIds((category.packageItems ?? []).map((pi) => pi.menuItem.id));
        setEditRatePerPersonText(formatSumInput(category.ratePerPerson));
        setEditDescription(category.description || '');
        setEditPhotos(category.photos ?? []);
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
                menuItemIds: editSelectedItemIds,
                ratePerPerson: parseSumToTiyin(editRatePerPersonText) ?? 0,
                description: editDescription.trim() || undefined,
                photos: editPhotos,
                isActive: editIsActive,
            },
        });
    };
    const canSubmit = validation.errors.length === 0 && !createMutation.isPending;
    const canSaveEdit = editValidation.errors.length === 0 && !updateMutation.isPending;
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: t('table_categories_management') }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: t('create_table_category') }), _jsxs("form", { onSubmit: (e) => { e.preventDefault(); if (!canSubmit)
                            return; createMutation.mutate(); }, style: { display: 'grid', gap: 14 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('name'), _jsx(Input, { value: name, onChange: (e) => setName(e.target.value), placeholder: t('table_category_name_placeholder') })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('rate_per_person'), _jsx(Input, { value: ratePerPersonText, onChange: (e) => setRatePerPersonText(e.target.value) })] })] }), _jsx(FoodPackageSection, { selectedCats: selectedCats, onCatsChange: setSelectedCats, selectedItemIds: selectedItemIds, onItemIdsChange: setSelectedItemIds, allMenuItems: allMenuItems, locale: locale }), _jsx(PhotosField, { photoUrls: photos, onChange: setPhotos }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('description_optional'), _jsx(Input, { value: description, onChange: (e) => setDescription(e.target.value) })] }), _jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx(Button, { type: "submit", disabled: !canSubmit, children: createMutation.isPending ? t('creating') : t('create_category') }), validation.errors.length > 0 && _jsx("span", { style: { color: '#b00020' }, children: validation.errors[0] }), createMutation.isError && (_jsx("span", { style: { color: '#b00020' }, children: createMutation.error instanceof Error ? createMutation.error.message : t('failed_to_create_category') }))] })] })] }), isLoading && _jsx("p", { children: t('loading_table_categories') }), isError && _jsx("p", { children: t('failed_to_load_table_categories') }), categories && (_jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12 }, children: [_jsx("h3", { style: { marginTop: 0 }, children: t('all_categories') }), categories.length === 0 ? (_jsx("p", { children: t('no_table_categories_yet') })) : (_jsx("div", { style: { display: 'grid', gap: 12 }, children: categories.map((category) => (_jsx("div", { style: { border: '1px solid #eee', padding: 12, borderRadius: 6 }, children: editingId === category.id ? (_jsxs("div", { style: { display: 'grid', gap: 14 }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('name'), _jsx(Input, { value: editName, onChange: (e) => setEditName(e.target.value) })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('rate_dollar'), _jsx(Input, { value: editRatePerPersonText, onChange: (e) => setEditRatePerPersonText(e.target.value) })] })] }), _jsx(FoodPackageSection, { selectedCats: editSelectedCats, onCatsChange: setEditSelectedCats, selectedItemIds: editSelectedItemIds, onItemIdsChange: setEditSelectedItemIds, allMenuItems: allMenuItems, locale: locale }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [t('description'), _jsx(Input, { value: editDescription, onChange: (e) => setEditDescription(e.target.value) })] }), _jsx(PhotosField, { photoUrls: editPhotos, onChange: setEditPhotos }), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9em' }, children: [_jsx("input", { type: "checkbox", checked: editIsActive, onChange: (e) => setEditIsActive(e.target.checked) }), t('active')] }), _jsxs("div", { style: { display: 'flex', gap: 4 }, children: [_jsx(Button, { onClick: saveEdit, disabled: !canSaveEdit, children: updateMutation.isPending ? t('saving') : t('save') }), _jsx(Button, { variant: "secondary", onClick: () => setEditingId(null), children: t('cancel') })] }), editValidation.errors.length > 0 && (_jsx("div", { style: { color: '#b00020', fontSize: '0.9em' }, children: editValidation.errors[0] }))] })) : (_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'flex-start' }, children: [(category.photos ?? []).length > 0 && (_jsxs("div", { style: { display: 'flex', gap: 4, flexShrink: 0 }, children: [(category.photos ?? []).slice(0, 4).map((url, i) => (_jsx("img", { src: getPhotoUrl(url), alt: "", style: { width: 56, height: 44, objectFit: 'cover', borderRadius: 4 } }, i))), (category.photos ?? []).length > 4 && (_jsxs("div", { style: {
                                                            width: 56, height: 44, borderRadius: 4,
                                                            background: '#f1f5f9', display: 'flex',
                                                            alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.8em', color: '#64748b', fontWeight: 600,
                                                        }, children: ["+", (category.photos ?? []).length - 4] }))] })), _jsxs("div", { children: [_jsx("strong", { children: category.name }), _jsxs("p", { style: { margin: '3px 0 0', fontSize: '0.85em', color: '#64748b' }, children: [t('rate'), ": ", formatSum(category.ratePerPerson), !category.isActive && ` • ${t('inactive')}`] }), parseCats(category.includedCategories).length > 0 && (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }, children: parseCats(category.includedCategories).map((cat) => (_jsx("span", { style: { fontSize: '0.75em', padding: '2px 8px', borderRadius: 12, background: '#dbeafe', color: '#1e40af' }, children: t(CATEGORY_LABEL_KEY[cat]) }, cat))) })), (category.packageItems ?? []).length > 0 && (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }, children: (category.packageItems ?? []).map((pi) => (_jsx("span", { style: { fontSize: '0.75em', padding: '2px 8px', borderRadius: 12, background: '#dcfce7', color: '#166534' }, children: pi.menuItem.name }, pi.id))) })), category.description && (_jsx("p", { style: { margin: '4px 0 0', fontSize: '0.82em', color: '#94a3b8' }, children: category.description }))] })] }), _jsxs("div", { style: { display: 'flex', gap: 4, flexShrink: 0 }, children: [_jsx("button", { onClick: () => startEditing(category), style: { background: '#28a745', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: t('edit') }), _jsx("button", { onClick: () => deleteMutation.mutate(category.id), disabled: deleteMutation.isPending, style: { background: '#b00020', color: 'white', padding: '4px 8px', border: 'none', borderRadius: 4, cursor: 'pointer' }, children: t('delete') })] })] })) }, category.id))) }))] }))] }));
};
