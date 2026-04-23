import { httpClient } from './http';
export class PhotoService {
    async uploadPhotos(category, files, dishCategory) {
        const formData = new FormData();
        formData.append('category', category);
        if (dishCategory)
            formData.append('dishCategory', dishCategory);
        files.forEach(file => formData.append('files', file));
        const response = await httpClient.post(`/photos/upload`, formData);
        return response.data.urls;
    }
    async listPhotos(category, dishCategory) {
        const params = dishCategory ? `?dishCategory=${encodeURIComponent(dishCategory)}` : '';
        const response = await httpClient.get(`/photos/${category}${params}`);
        return response.data.photos;
    }
    async deletePhoto(category, filename, dishCategory) {
        const params = dishCategory ? `?dishCategory=${encodeURIComponent(dishCategory)}` : '';
        await httpClient.delete(`/photos/${category}/${filename}${params}`);
    }
}
export const photoService = new PhotoService();
