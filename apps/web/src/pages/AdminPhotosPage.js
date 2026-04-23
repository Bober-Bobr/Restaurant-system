import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { getPhotoUrl } from '../utils/photoUrl';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
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
            // /uploads/menu/hot_appetizers/photo.jpg → 5 parts
            const filename = parts[parts.length - 1];
            const dishCat = parts.length === 5 ? parts[3] : undefined;
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
    return (_jsx("main", { className: "px-4 py-6 sm:px-6 lg:px-8", children: _jsxs("div", { className: "mx-auto max-w-6xl space-y-6", children: [_jsx("h1", { className: "page-heading", children: t('photo_management') }), _jsxs("section", { className: "card p-6", children: [_jsx("p", { className: "section-heading mb-4", children: t('upload_photos') }), _jsxs("div", { className: "flex flex-wrap items-end gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('photo_category') }), _jsxs(Select, { value: category, onChange: (e) => { setCategory(e.target.value); setDishCategory(''); }, className: "w-48", children: [_jsx("option", { value: "menu", children: t('menu_photos') }), _jsx("option", { value: "hall", children: t('hall_photos') }), _jsx("option", { value: "table", children: t('table_photos') })] })] }), category === 'menu' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-sm font-medium text-slate-700", children: t('dish_category') }), _jsxs(Select, { value: dishCategory, onChange: (e) => setDishCategory(e.target.value), className: "w-52", children: [_jsx("option", { value: "", children: t('filter_all') }), DISH_CATEGORIES.map((dc) => (_jsx("option", { value: dc, children: t(DISH_CATEGORY_LABEL_KEY[dc]) }, dc)))] })] })), _jsx(Button, { type: "button", onClick: () => fileInputRef.current?.click(), disabled: uploadMutation.isPending, children: uploadMutation.isPending ? t('uploading') : t('select_upload_files') }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: "image/*", onChange: handleFileSelect, className: "hidden" })] }), _jsx("p", { className: "mt-3 text-sm text-slate-500", children: t('upload_photos_help') })] }), _jsxs("section", { className: "card p-6", children: [_jsxs("p", { className: "section-heading mb-4", children: [getCategoryLabel(category), category === 'menu' && dishCategory && (_jsxs("span", { className: "ml-2 text-base font-normal text-slate-500", children: ["\u2014 ", t(DISH_CATEGORY_LABEL_KEY[dishCategory])] })), _jsxs("span", { className: "ml-2 text-base font-normal text-slate-500", children: ["(", photos.length, ")"] })] }), isLoading ? (_jsx("div", { className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", children: Array.from({ length: 10 }).map((_, i) => (_jsx("div", { className: "aspect-square animate-pulse rounded-2xl bg-slate-100" }, i))) })) : isError ? (_jsx("p", { className: "text-sm text-red-600", children: t('failed_load_photos') })) : photos.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-slate-400", children: [_jsx("svg", { className: "mb-3 h-10 w-10", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), _jsx("p", { className: "text-sm", children: t('no_photos_uploaded') })] })) : (_jsx("div", { className: "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5", children: photos.map((photoUrl) => {
                                const filename = photoUrl.split('/').pop() ?? '';
                                const isDeleting = deleteMutation.isPending && deleteMutation.variables === photoUrl;
                                // Show dish category badge when in "All" view
                                const parts = photoUrl.split('/');
                                const photoDishCat = parts.length === 5 ? parts[3] : null;
                                return (_jsxs("div", { className: "group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm transition-shadow hover:shadow-md", children: [_jsx("div", { className: "aspect-square", children: _jsx("img", { src: getPhotoUrl(photoUrl), alt: filename, className: "h-full w-full object-cover" }) }), _jsxs("div", { className: "p-3", children: [photoDishCat && !dishCategory && (_jsx("p", { className: "mb-1 truncate text-xs font-medium text-slate-400 uppercase tracking-wide", children: photoDishCat.replace(/_/g, ' ') })), _jsx("p", { className: "truncate text-xs text-slate-500", title: filename, children: filename }), _jsx("button", { type: "button", onClick: () => handleDelete(photoUrl), disabled: isDeleting || deleteMutation.isPending, className: "mt-2 w-full rounded-xl border border-red-200 bg-white py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50", children: isDeleting ? t('deleting') : t('delete') })] }), _jsx("div", { className: "pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-transparent transition-all group-hover:ring-slate-300" })] }, photoUrl));
                            }) }))] })] }) }));
};
