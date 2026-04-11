import { httpClient } from './http';

export type PhotoCategory = 'menu' | 'hall' | 'table';

export class PhotoService {
  async uploadPhotos(category: PhotoCategory, files: File[]): Promise<string[]> {
    const formData = new FormData();
    formData.append('category', category);

    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await httpClient.post<{ urls: string[] }>(`/photos/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.urls;
  }

  async listPhotos(category: PhotoCategory): Promise<string[]> {
    const response = await httpClient.get<{ photos: string[] }>(`/photos/${category}`);
    return response.data.photos;
  }

  async deletePhoto(category: PhotoCategory, filename: string): Promise<void> {
    await httpClient.delete(`/photos/${category}/${filename}`);
  }
}

export const photoService = new PhotoService();