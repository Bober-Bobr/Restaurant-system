import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService } from '../../services/photo.service';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
import { getPhotoUrl } from '../../utils/photoUrl';
import { Button } from './button';
export const PhotoSelector = ({ category, selectedPhotoUrl, onPhotoSelect, placeholder }) => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const { data: photos = [], isLoading } = useQuery({
        queryKey: ['photos', category],
        queryFn: () => photoService.listPhotos(category)
    });
    const uploadMutation = useMutation({
        mutationFn: (files) => photoService.uploadPhotos(category, files),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
            setIsUploading(false);
        },
        onError: () => {
            setIsUploading(false);
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (filename) => photoService.deletePhoto(category, filename),
        onSuccess: (_, filename) => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
            // If the deleted photo was selected, clear selection
            if (selectedPhotoUrl?.includes(filename)) {
                onPhotoSelect(undefined);
            }
        }
    });
    const handleFileSelect = async (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length === 0)
            return;
        setIsUploading(true);
        try {
            await uploadMutation.mutateAsync(files);
        }
        catch (error) {
            console.error('Failed to upload photos:', error);
        }
        // Clear the input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    const handlePhotoClick = (photoUrl) => {
        if (selectedPhotoUrl === photoUrl) {
            onPhotoSelect(undefined); // Deselect if already selected
        }
        else {
            onPhotoSelect(photoUrl);
        }
    };
    const handleDeletePhoto = async (photoUrl, event) => {
        event.stopPropagation();
        const filename = photoUrl.split('/').pop();
        if (filename && confirm(translate('confirm_delete_photo', locale))) {
            try {
                await deleteMutation.mutateAsync(filename);
            }
            catch (error) {
                console.error('Failed to delete photo:', error);
            }
        }
    };
    const getCategoryLabel = (cat) => {
        switch (cat) {
            case 'menu': return translate('menu_photos', locale);
            case 'hall': return translate('hall_photos', locale);
            case 'table': return translate('table_photos', locale);
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h4", { className: "text-sm font-medium", children: getCategoryLabel(category) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", onClick: () => fileInputRef.current?.click(), disabled: isUploading, children: isUploading ? translate('uploading', locale) : translate('upload_photos', locale) }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: "image/*", onChange: handleFileSelect, className: "hidden" })] })] }), placeholder && !selectedPhotoUrl && (_jsx("p", { className: "text-sm text-gray-500", children: placeholder })), selectedPhotoUrl && (_jsx("div", { className: "border-2 border-blue-300 rounded-lg p-2 bg-blue-50", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("img", { src: getPhotoUrl(selectedPhotoUrl), alt: "Selected", className: "w-16 h-16 object-cover rounded" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm font-medium text-blue-700", children: translate('selected_photo', locale) }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onPhotoSelect(undefined), className: "text-blue-600 hover:text-blue-800", children: translate('clear_selection', locale) })] })] }) })), _jsx("div", { className: "grid grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2", children: isLoading ? (_jsx("div", { className: "col-span-4 text-center py-4", children: translate('loading_photos', locale) })) : photos.length === 0 ? (_jsx("div", { className: "col-span-4 text-center py-4 text-gray-500", children: translate('no_photos_uploaded', locale) })) : (photos.map((photoUrl) => (_jsxs("div", { className: `relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${selectedPhotoUrl === photoUrl
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'}`, onClick: () => handlePhotoClick(photoUrl), children: [_jsx("img", { src: getPhotoUrl(photoUrl), alt: "", className: "w-full h-20 object-cover" }), _jsx("button", { type: "button", className: "absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600", onClick: (e) => handleDeletePhoto(photoUrl, e), disabled: deleteMutation.isPending, children: "\u00D7" }), selectedPhotoUrl === photoUrl && (_jsx("div", { className: "absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center", children: _jsx("div", { className: "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm", children: "\u2713" }) }))] }, photoUrl)))) })] }));
};
