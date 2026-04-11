import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService } from '../services/photo.service';
import { useAdminStore } from '../store/admin.store';
import { translate } from '../utils/translate';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
export const AdminPhotosPage = () => {
    const queryClient = useQueryClient();
    const { locale } = useAdminStore();
    const fileInputRef = useRef(null);
    const [category, setCategory] = useState('menu');
    const [isUploading, setIsUploading] = useState(false);
    const t = (key) => translate(key, locale);
    const { data: photos = [], isLoading, isError } = useQuery({
        queryKey: ['photos', category],
        queryFn: () => photoService.listPhotos(category)
    });
    const uploadMutation = useMutation({
        mutationFn: (files) => photoService.uploadPhotos(category, files),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        },
        onError: () => {
            setIsUploading(false);
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (filename) => photoService.deletePhoto(category, filename),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['photos', category] });
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
    };
    const handleDeletePhoto = async (photoUrl) => {
        const filename = photoUrl.split('/').pop();
        if (filename && confirm(t('confirm_delete_photo'))) {
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
            case 'menu': return t('menu_photos');
            case 'hall': return t('hall_photos');
            case 'table': return t('table_photos');
        }
    };
    return (_jsxs("main", { style: { padding: 20 }, children: [_jsx("h1", { children: t('photo_management') }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 16 }, children: [_jsx("h3", { children: t('upload_photos') }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'end' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [t('photo_category'), _jsxs(Select, { value: category, onChange: (e) => setCategory(e.target.value), children: [_jsx("option", { value: "menu", children: t('menu_photos') }), _jsx("option", { value: "hall", children: t('hall_photos') }), _jsx("option", { value: "table", children: t('table_photos') })] })] }), _jsx(Button, { type: "button", onClick: () => fileInputRef.current?.click(), disabled: isUploading, children: isUploading ? t('uploading') : t('select_upload_files') }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, accept: "image/*", onChange: handleFileSelect, className: "hidden" })] }), _jsx("p", { style: { marginTop: 8, fontSize: '0.875rem', color: '#666' }, children: t('upload_photos_help') })] }), _jsxs("section", { style: { border: '1px solid #ddd', borderRadius: 8, padding: 12 }, children: [_jsxs("h3", { children: [getCategoryLabel(category), " (", photos.length, ")"] }), isLoading ? (_jsx("p", { children: t('loading_photos') })) : isError ? (_jsx("p", { style: { color: '#b00020' }, children: t('failed_load_photos') })) : photos.length === 0 ? (_jsx("p", { style: { color: '#666' }, children: t('no_photos_uploaded') })) : (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }, children: photos.map((photoUrl) => {
                            const filename = photoUrl.split('/').pop() || '';
                            return (_jsxs("div", { style: {
                                    border: '1px solid #eee',
                                    borderRadius: 8,
                                    overflow: 'hidden',
                                    backgroundColor: '#fafafa'
                                }, children: [_jsx("img", { src: photoUrl, alt: filename, style: {
                                            width: '100%',
                                            height: 150,
                                            objectFit: 'cover'
                                        } }), _jsxs("div", { style: { padding: 8 }, children: [_jsx("p", { style: { fontSize: '0.75rem', color: '#666', margin: 0, marginBottom: 8, wordBreak: 'break-all', maxHeight: 40, overflow: 'hidden' }, children: filename }), _jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => handleDeletePhoto(photoUrl), disabled: deleteMutation.isPending, style: { width: '100%' }, children: deleteMutation.isPending ? t('deleting') : t('delete') })] })] }, photoUrl));
                        }) }))] })] }));
};
