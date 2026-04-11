import { promises as fs } from 'fs';
import path from 'path';
import createHttpError from 'http-errors';
export class PhotoService {
    uploadDir;
    constructor() {
        // Use an absolute path for uploads
        this.uploadDir = path.resolve(process.cwd(), 'uploads');
        this.ensureDirectoriesExist();
    }
    async ensureDirectoriesExist() {
        const categories = ['menu', 'hall', 'table'];
        // Ensure root uploads directory exists
        try {
            await fs.access(this.uploadDir);
        }
        catch {
            await fs.mkdir(this.uploadDir, { recursive: true });
        }
        // Ensure category subdirectories exist
        for (const category of categories) {
            const categoryDir = path.join(this.uploadDir, category);
            try {
                await fs.access(categoryDir);
            }
            catch {
                await fs.mkdir(categoryDir, { recursive: true });
            }
        }
    }
    async uploadPhotos(category, files) {
        const categoryDir = path.join(this.uploadDir, category);
        const uploadedUrls = [];
        for (const file of files) {
            // Generate unique filename
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 8);
            const extension = path.extname(file.originalname).toLowerCase();
            const filename = `${timestamp}-${random}${extension}`;
            const filePath = path.join(categoryDir, filename);
            // Write file buffer directly (Express Multer already provides Buffer)
            await fs.writeFile(filePath, file.buffer);
            // Return relative URL path
            const urlPath = `/uploads/${category}/${filename}`;
            uploadedUrls.push(urlPath);
        }
        return uploadedUrls;
    }
    async listPhotos(category) {
        const categoryDir = path.join(this.uploadDir, category);
        try {
            const files = await fs.readdir(categoryDir);
            // Filter for image files and return URLs
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            return files
                .filter(file => imageExtensions.includes(path.extname(file).toLowerCase()))
                .map(file => `/uploads/${category}/${file}`)
                .sort(); // Sort for consistent ordering
        }
        catch (error) {
            // If directory doesn't exist, return empty array
            return [];
        }
    }
    async deletePhoto(category, filename) {
        // Validate filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw createHttpError(400, 'Invalid filename');
        }
        const filePath = path.join(this.uploadDir, category, filename);
        try {
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw createHttpError(404, 'Photo not found');
            }
            throw createHttpError(500, 'Failed to delete photo');
        }
    }
    async getPhotoPath(category, filename) {
        // Validate filename to prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            throw createHttpError(400, 'Invalid filename');
        }
        const filePath = path.join(this.uploadDir, category, filename);
        try {
            await fs.access(filePath);
            return filePath;
        }
        catch {
            throw createHttpError(404, 'Photo not found');
        }
    }
}
