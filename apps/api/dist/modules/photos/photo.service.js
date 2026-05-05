import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import createHttpError from 'http-errors';
const DISH_CATEGORIES = [
    'cold_appetizers', 'hot_appetizers', 'salads',
    'first_course', 'second_course', 'drinks', 'sweets', 'fruits',
];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export class PhotoService {
    uploadDir;
    constructor() {
        this.uploadDir = path.resolve(__dirname, '..', '..', '..', 'uploads');
    }
    restaurantSlug(restaurantId) {
        return restaurantId ?? 'shared';
    }
    getBaseDir(restaurantId) {
        return path.join(this.uploadDir, this.restaurantSlug(restaurantId));
    }
    async listFilesInDir(dir, urlPrefix) {
        try {
            const files = await fs.readdir(dir);
            return files
                .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
                .map(f => `${urlPrefix}/${f}`)
                .sort();
        }
        catch {
            return [];
        }
    }
    async uploadPhotos(category, files, restaurantId, dishCategory) {
        const baseDir = this.getBaseDir(restaurantId);
        const dir = category === 'menu' && dishCategory
            ? path.join(baseDir, category, dishCategory)
            : path.join(baseDir, category);
        await fs.mkdir(dir, { recursive: true });
        const slug = this.restaurantSlug(restaurantId);
        const uploadedUrls = [];
        for (const file of files) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const extension = path.extname(file.originalname).toLowerCase();
            const filename = `${timestamp}-${random}${extension}`;
            await fs.writeFile(path.join(dir, filename), file.buffer);
            const urlPath = category === 'menu' && dishCategory
                ? `/uploads/${slug}/${category}/${dishCategory}/${filename}`
                : `/uploads/${slug}/${category}/${filename}`;
            uploadedUrls.push(urlPath);
        }
        return uploadedUrls;
    }
    async listPhotos(category, restaurantId, dishCategory) {
        const baseDir = this.getBaseDir(restaurantId);
        const slug = this.restaurantSlug(restaurantId);
        const categoryDir = path.join(baseDir, category);
        if (category === 'menu' && dishCategory) {
            return this.listFilesInDir(path.join(categoryDir, dishCategory), `/uploads/${slug}/${category}/${dishCategory}`);
        }
        if (category === 'menu') {
            const all = await this.listFilesInDir(categoryDir, `/uploads/${slug}/${category}`);
            for (const dishCat of DISH_CATEGORIES) {
                const sub = await this.listFilesInDir(path.join(categoryDir, dishCat), `/uploads/${slug}/${category}/${dishCat}`);
                all.push(...sub);
            }
            return all.sort();
        }
        return this.listFilesInDir(categoryDir, `/uploads/${slug}/${category}`);
    }
    async deletePhoto(category, filename, restaurantId, dishCategory) {
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw createHttpError(400, 'Invalid filename');
        }
        const baseDir = this.getBaseDir(restaurantId);
        const filePath = category === 'menu' && dishCategory
            ? path.join(baseDir, category, dishCategory, filename)
            : path.join(baseDir, category, filename);
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                throw createHttpError(404, 'Photo not found');
            throw createHttpError(500, 'Failed to delete photo');
        }
    }
}
