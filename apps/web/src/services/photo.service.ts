import { httpClient } from './http';

export type PhotoCategory = 'menu' | 'hall' | 'table' | 'invitation';

export class PhotoService {
  async uploadPhotos(
    category: PhotoCategory,
    files: File[],
    dishCategory?: string,
    restaurantId?: string,
  ): Promise<string[]> {
    const formData = new FormData();
    formData.append('category', category);
    if (dishCategory) formData.append('dishCategory', dishCategory);
    if (restaurantId) formData.append('restaurantId', restaurantId);
    files.forEach(file => formData.append('files', file));
    const response = await httpClient.post<{ urls: string[] }>(`/photos/upload`, formData);
    return response.data.urls;
  }

  async uploadAudio(files: File[], restaurantId?: string): Promise<string[]> {
    const formData = new FormData();
    if (restaurantId) formData.append('restaurantId', restaurantId);
    files.forEach(file => formData.append('files', file));
    const response = await httpClient.post<{ urls: string[] }>(`/photos/upload-audio`, formData);
    return response.data.urls;
  }

  async listPhotos(category: PhotoCategory, dishCategory?: string): Promise<string[]> {
    const params = dishCategory ? `?dishCategory=${encodeURIComponent(dishCategory)}` : '';
    const response = await httpClient.get<{ photos: string[] }>(`/photos/${category}${params}`);
    return response.data.photos;
  }

  async deletePhoto(category: PhotoCategory, filename: string, dishCategory?: string): Promise<void> {
    const params = dishCategory ? `?dishCategory=${encodeURIComponent(dishCategory)}` : '';
    await httpClient.delete(`/photos/${category}/${filename}${params}`);
  }
}

export const photoService = new PhotoService();