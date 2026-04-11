import { httpClient } from './http';
export class PhotoService {
    async uploadPhotos(category, files) {
        const formData = new FormData();
        formData.append('category', category);
        files.forEach(file => {
            formData.append('files', file);
        });
        const response = await httpClient.post(`/photos/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.urls;
    }
    async listPhotos(category) {
        const response = await httpClient.get(`/photos/${category}`);
        return response.data.photos;
    }
    async deletePhoto(category, filename) {
        await httpClient.delete(`/photos/${category}/${filename}`);
    }
}
export const photoService = new PhotoService();
