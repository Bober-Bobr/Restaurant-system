import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { photoService, type PhotoCategory } from '../../services/photo.service';
import { useAdminStore } from '../../store/admin.store';
import { translate } from '../../utils/translate';
import { getPhotoUrl } from '../../utils/photoUrl';
import { Button } from './button';

interface PhotoSelectorProps {
  category: PhotoCategory;
  selectedPhotoUrl?: string;
  onPhotoSelect: (photoUrl: string | undefined) => void;
  placeholder?: string;
}

export const PhotoSelector = ({
  category,
  selectedPhotoUrl,
  onPhotoSelect,
  placeholder
}: PhotoSelectorProps) => {
  const queryClient = useQueryClient();
  const { locale } = useAdminStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', category],
    queryFn: () => photoService.listPhotos(category)
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => photoService.uploadPhotos(category, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      setIsUploading(false);
    },
    onError: () => {
      setIsUploading(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => photoService.deletePhoto(category, filename),
    onSuccess: (_, filename) => {
      queryClient.invalidateQueries({ queryKey: ['photos', category] });
      // If the deleted photo was selected, clear selection
      if (selectedPhotoUrl?.includes(filename)) {
        onPhotoSelect(undefined);
      }
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(files);
    } catch (error) {
      console.error('Failed to upload photos:', error);
    }
    // Clear the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePhotoClick = (photoUrl: string) => {
    if (selectedPhotoUrl === photoUrl) {
      onPhotoSelect(undefined); // Deselect if already selected
    } else {
      onPhotoSelect(photoUrl);
    }
  };

  const handleDeletePhoto = async (photoUrl: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const filename = photoUrl.split('/').pop();
    if (filename && confirm(translate('confirm_delete_photo', locale))) {
      try {
        await deleteMutation.mutateAsync(filename);
      } catch (error) {
        console.error('Failed to delete photo:', error);
      }
    }
  };

  const getCategoryLabel = (cat: PhotoCategory) => {
    switch (cat) {
      case 'menu': return translate('menu_photos', locale);
      case 'hall': return translate('hall_photos', locale);
      case 'table': return translate('table_photos', locale);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{getCategoryLabel(category)}</h4>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? translate('uploading', locale) : translate('upload_photos', locale)}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {placeholder && !selectedPhotoUrl && (
        <p className="text-sm text-gray-500">{placeholder}</p>
      )}

      {selectedPhotoUrl && (
        <div className="border-2 border-blue-300 rounded-lg p-2 bg-blue-50">
          <div className="flex items-center gap-2">
            <img
              src={getPhotoUrl(selectedPhotoUrl)}
              alt="Selected"
              className="w-16 h-16 object-cover rounded"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-700">
                {translate('selected_photo', locale)}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onPhotoSelect(undefined)}
                className="text-blue-600 hover:text-blue-800"
              >
                {translate('clear_selection', locale)}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto border rounded-lg p-2">
        {isLoading ? (
          <div className="col-span-4 text-center py-4">
            {translate('loading_photos', locale)}
          </div>
        ) : photos.length === 0 ? (
          <div className="col-span-4 text-center py-4 text-gray-500">
            {translate('no_photos_uploaded', locale)}
          </div>
        ) : (
          photos.map((photoUrl) => (
            <div
              key={photoUrl}
              className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                selectedPhotoUrl === photoUrl
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handlePhotoClick(photoUrl)}
            >
              <img
                src={getPhotoUrl(photoUrl)}
                alt=""
                className="w-full h-20 object-cover"
              />
              <button
                type="button"
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                onClick={(e) => handleDeletePhoto(photoUrl, e)}
                disabled={deleteMutation.isPending}
              >
                ×
              </button>
              {selectedPhotoUrl === photoUrl && (
                <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                  <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    ✓
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};