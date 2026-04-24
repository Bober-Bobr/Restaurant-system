import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { photoService } from '../../services/photo.service';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
import { getPhotoUrl } from '../../utils/photoUrl';
import { Lightbox } from './lightbox';
export const PhotoSelector = ({ category, dishCategory, selectedPhotoUrl, onPhotoSelect, placeholder }) => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const [previewUrl, setPreviewUrl] = useState(null);
    const { data: photos = [], isLoading } = useQuery({
        queryKey: ['photos', category, dishCategory ?? ''],
        queryFn: () => photoService.listPhotos(category, dishCategory)
    });
    const deleteMutation = useMutation({
        mutationFn: ({ filename, dishCat }) => photoService.deletePhoto(category, filename, dishCat),
        onSuccess: (_, { filename }) => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
            if (selectedPhotoUrl?.includes(filename))
                onPhotoSelect(undefined);
        }
    });
    const handlePhotoClick = (photoUrl) => {
        onPhotoSelect(selectedPhotoUrl === photoUrl ? undefined : photoUrl);
    };
    const handleDeletePhoto = async (photoUrl, event) => {
        event.stopPropagation();
        const parts = photoUrl.split('/');
        const filename = parts[parts.length - 1];
        const dishCat = parts.length === 5 ? parts[3] : undefined;
        if (filename && confirm(translate('confirm_delete_photo', locale))) {
            try {
                await deleteMutation.mutateAsync({ filename, dishCat });
            }
            catch (error) {
                console.error('Failed to delete photo:', error);
            }
        }
    };
    return (_jsxs(_Fragment, { children: [previewUrl && (_jsx(Lightbox, { src: previewUrl, onClose: () => setPreviewUrl(null) })), _jsxs("div", { className: "space-y-3", children: [placeholder && !selectedPhotoUrl && (_jsx("p", { className: "text-sm text-gray-500", children: placeholder })), selectedPhotoUrl && (_jsx("div", { className: "border-2 border-blue-300 rounded-lg p-2 bg-blue-50", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", onClick: () => setPreviewUrl(getPhotoUrl(selectedPhotoUrl) ?? null), className: "flex-shrink-0", children: _jsx("img", { src: getPhotoUrl(selectedPhotoUrl), alt: "Selected", className: "w-16 h-16 object-cover rounded hover:opacity-80 transition-opacity" }) }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-blue-700", children: translate('selected_photo', locale) }), _jsx("button", { type: "button", onClick: () => onPhotoSelect(undefined), className: "text-xs text-blue-600 hover:text-blue-800 underline", children: translate('clear_selection', locale) })] })] }) })), _jsx("div", { className: "grid grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2", children: isLoading ? (_jsx("div", { className: "col-span-4 text-center py-4", children: translate('loading_photos', locale) })) : photos.length === 0 ? (_jsx("div", { className: "col-span-4 text-center py-4 text-gray-500", children: translate('no_photos_uploaded', locale) })) : (photos.map((photoUrl) => (_jsxs("div", { className: `relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${selectedPhotoUrl === photoUrl
                                ? 'border-blue-500 ring-2 ring-blue-200'
                                : 'border-gray-200 hover:border-gray-300'}`, onClick: () => handlePhotoClick(photoUrl), children: [_jsx("img", { src: getPhotoUrl(photoUrl), alt: "", className: "w-full h-20 object-cover" }), _jsx("button", { type: "button", className: "absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600", onClick: (e) => handleDeletePhoto(photoUrl, e), disabled: deleteMutation.isPending, children: "\u00D7" }), _jsx("button", { type: "button", className: "absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70", onClick: (e) => { e.stopPropagation(); setPreviewUrl(getPhotoUrl(photoUrl) ?? null); }, children: _jsx("svg", { className: "h-3 w-3", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" }) }) }), selectedPhotoUrl === photoUrl && (_jsx("div", { className: "absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center", children: _jsx("div", { className: "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm", children: "\u2713" }) }))] }, photoUrl)))) })] })] }));
};
