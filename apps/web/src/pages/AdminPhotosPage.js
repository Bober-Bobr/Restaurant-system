import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Lightbox } from '../components/ui/lightbox';
const DISH_CATEGORIES = [
    'cold_appetizers', 'hot_appetizers', 'salads',
    'first_course', 'second_course', 'drinks', 'sweets', 'fruits',
];
const DISH_CATEGORY_LABEL_KEY = {
    cold_appetizers: 'cold_appetizers',
    hot_appetizers: 'hot_appetizers',
    salads: 'salads',
    first_course: 'first_course',
    second_course: 'second_course',
    drinks: 'drinks',
    sweets: 'sweets',
    fruits: 'fruits',
};
export const AdminPhotosPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const fileInputRef = useRef(null);
    const [category, setCategory] = useState('menu');
    const [dishCategory, setDishCategory] = useState('');
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const t = (key) => translate(key, locale);
    const effectiveDishCategory = category === 'menu' && dishCategory ? dishCategory : undefined;
    const { data: photos = [], isLoading, isError } = useQuery({
        queryKey: ['photos', category, effectiveDishCategory ?? ''],
        queryFn: () => photoService.listPhotos(category, effectiveDishCategory)
    });
    const uploadMutation = useMutation({
        mutationFn: (files) => photoService.uploadPhotos(category, files, effectiveDishCategory),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
            if (fileInputRef.current)
                fileInputRef.current.value = '';
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (photoUrl) => {
            const parts = photoUrl.split('/');
            // /uploads/{rid}/menu/hot_appetizers/photo.jpg → 6 parts (with dish category)
            // /uploads/{rid}/menu/photo.jpg → 5 parts
            const filename = parts[parts.length - 1];
            const dishCat = parts.length === 6 ? parts[4] : undefined;
            return photoService.deletePhoto(category, filename, dishCat);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
        }
    });
    const handleFileSelect = async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0)
            return;
        try {
            await uploadMutation.mutateAsync(files);
        }
        catch (error) {
            console.error('Failed to upload photos:', error);
        }
    };
    const handleDelete = async (photoUrl) => {
        if (confirm(t('confirm_delete_photo'))) {
            try {
                await deleteMutation.mutateAsync(photoUrl);
            }
            catch (error) {
                console.error('Failed to delete photo:', error);
            }
        }
    };
    const getCategoryLabel = (cat) => {
        switch (cat) {
            case 'menu': return t('menu_photos');
            case 'hall': return t('hall_photos');
            case 'table': return t('table_photos');
        }
    };
    return (_jsxs(_Fragment, { children: [lightboxSrc && _jsx(Lightbox, { src: lightboxSrc, onClose: () => setLightboxSrc(null) }), _jsx("main", { className: "tablet-fade-in", style: { maxWidth: 1280, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: _jsxs("div", { style: { display: 'grid', gap: 18 }, children: [_jsx("h1", { className: "adm-title", children: t('photo_management') }), _jsxs("section", { className: "adm-card tablet-fade-up adm-section", children: [_jsx("p", { className: "adm-heading", style: { marginBottom: 16 }, children: t('upload_photos') }), _jsxs("div", { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }, children: [_jsxs("div", { style: { display: 'grid', gap: 6 }, children: [_jsx("label", { className: "adm-label", children: t('photo_category') }), _jsxs(Select, { value: category, onChange: (e) => { setCategory(e.target.value); setDishCategory(''); }, className: "w-48", children: [_jsx("option", { value: "menu", children: t('menu_photos') }), _jsx("option", { value: "hall", children: t('hall_photos') }), _jsx("option", { value: "table", children: t('table_photos') })] })] }), category === 'menu' && (_jsxs("div", { style: { display: 'grid', gap: 6 }, children: [_jsx("label", { className: "adm-label", children: t('dish_category') }), _jsxs(Select, { value: dishCategory, onChange: (e) => setDishCategory(e.target.value), className: "w-52", children: [_jsx("option", { value: "", children: t('filter_all') }), DISH_CATEGORIES.map((dc) => (_jsx("option", { value: dc, children: t(DISH_CATEGORY_LABEL_KEY[dc]) }, dc)))] })] })), _jsx(Button, { type: "button", onClick: () => fileInputRef.current?.click(), disabled: uploadMutation.isPending, children: uploadMutation.isPending ? t('uploading') : t('select_upload_files') }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: "image/*", onChange: handleFileSelect, className: "hidden" })] }), _jsx("p", { style: { marginTop: 12, fontSize: 13, color: 'rgba(226,232,240,0.55)' }, children: t('upload_photos_help') })] }), _jsxs("section", { className: "adm-card tablet-fade-up adm-section", style: { animationDelay: '80ms' }, children: [_jsxs("p", { className: "adm-heading", style: { marginBottom: 14 }, children: [getCategoryLabel(category), category === 'menu' && dishCategory && (_jsxs("span", { style: { marginLeft: 8, fontSize: 13, fontWeight: 500, color: 'rgba(226,232,240,0.55)', textTransform: 'none', letterSpacing: 0 }, children: ["\u2014 ", t(DISH_CATEGORY_LABEL_KEY[dishCategory])] })), _jsxs("span", { style: { marginLeft: 8, fontSize: 13, fontWeight: 500, color: 'rgba(226,232,240,0.55)', textTransform: 'none', letterSpacing: 0 }, children: ["(", photos.length, ")"] })] }), isLoading ? (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }, children: Array.from({ length: 10 }).map((_, i) => (_jsx("div", { className: "rg-shimmer", style: { aspectRatio: '1 / 1', borderRadius: 16 } }, i))) })) : isError ? (_jsx("p", { style: { fontSize: 14, color: '#fca5a5' }, children: t('failed_load_photos') })) : photos.length === 0 ? (_jsxs("div", { style: {
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        padding: '60px 16px', color: 'rgba(226,232,240,0.45)',
                                        border: '2px dashed rgba(255,255,255,0.08)', borderRadius: 16,
                                    }, children: [_jsx("svg", { width: "40", height: "40", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", style: { marginBottom: 12 }, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), _jsx("p", { style: { fontSize: 14 }, children: t('no_photos_uploaded') })] })) : (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }, children: photos.map((photoUrl) => {
                                        const filename = photoUrl.split('/').pop() ?? '';
                                        const isDeleting = deleteMutation.isPending && deleteMutation.variables === photoUrl;
                                        // Show dish category badge when in "All" view
                                        const parts = photoUrl.split('/');
                                        const photoDishCat = parts.length === 6 ? parts[4] : null;
                                        return (_jsxs("div", { className: "adm-card adm-card-hover tablet-fade-up", style: { overflow: 'hidden', position: 'relative' }, children: [_jsx("button", { type: "button", onClick: () => setLightboxSrc(getPhotoUrl(photoUrl) ?? null), style: { display: 'block', width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'rgba(15,23,42,0.5)', border: 'none', padding: 0, cursor: 'pointer' }, children: _jsx("img", { src: getPhotoUrl(photoUrl), alt: filename, style: { width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' } }) }), _jsxs("div", { style: { padding: 12 }, children: [photoDishCat && !dishCategory && (_jsx("p", { className: "adm-label", style: { marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: photoDishCat.replace(/_/g, ' ') })), _jsx("p", { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'rgba(226,232,240,0.6)' }, title: filename, children: filename }), _jsx("button", { type: "button", onClick: () => handleDelete(photoUrl), disabled: isDeleting || deleteMutation.isPending, className: "adm-btn-danger", style: { marginTop: 10, width: '100%', fontSize: 12 }, children: isDeleting ? t('deleting') : t('delete') })] })] }, photoUrl));
                                    }) }))] })] }) })] }));
};
