import { promises as fs } from 'fs';
import path from 'path';
import createHttpError from 'http-errors';

export type PhotoCategory = 'menu' | 'hall' | 'table';

const DISH_CATEGORIES = [
  'cold_appetizers', 'hot_appetizers', 'salads',
  'first_course', 'second_course', 'drinks', 'sweets', 'fruits',
] as const;

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

export class PhotoService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads');
    this.ensureDirectoriesExist();
  }

  private async ensureDirectoriesExist() {
    const categories: PhotoCategory[] = ['menu', 'hall', 'table'];
    for (const category of categories) {
      await fs.mkdir(path.join(this.uploadDir, category), { recursive: true });
    }
    for (const dishCat of DISH_CATEGORIES) {
      await fs.mkdir(path.join(this.uploadDir, 'menu', dishCat), { recursive: true });
    }
  }

  private async listFilesInDir(dir: string, urlPrefix: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
        .map(f => `${urlPrefix}/${f}`)
        .sort();
    } catch {
      return [];
    }
  }

  async uploadPhotos(category: PhotoCategory, files: Express.Multer.File[], dishCategory?: string): Promise<string[]> {
    const dir = category === 'menu' && dishCategory
      ? path.join(this.uploadDir, category, dishCategory)
      : path.join(this.uploadDir, category);

    await fs.mkdir(dir, { recursive: true });

    const uploadedUrls: string[] = [];
    for (const file of files) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${timestamp}-${random}${extension}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      const urlPath = category === 'menu' && dishCategory
        ? `/uploads/${category}/${dishCategory}/${filename}`
        : `/uploads/${category}/${filename}`;
      uploadedUrls.push(urlPath);
    }
    return uploadedUrls;
  }

  async listPhotos(category: PhotoCategory, dishCategory?: string): Promise<string[]> {
    const categoryDir = path.join(this.uploadDir, category);

    if (category === 'menu' && dishCategory) {
      return this.listFilesInDir(
        path.join(categoryDir, dishCategory),
        `/uploads/${category}/${dishCategory}`
      );
    }

    if (category === 'menu') {
      // All menu photos: root + every dish category subdir
      const all: string[] = await this.listFilesInDir(categoryDir, `/uploads/${category}`);
      for (const dishCat of DISH_CATEGORIES) {
        const sub = await this.listFilesInDir(
          path.join(categoryDir, dishCat),
          `/uploads/${category}/${dishCat}`
        );
        all.push(...sub);
      }
      return all.sort();
    }

    return this.listFilesInDir(categoryDir, `/uploads/${category}`);
  }

  async deletePhoto(category: PhotoCategory, filename: string, dishCategory?: string): Promise<void> {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw createHttpError(400, 'Invalid filename');
    }
    const filePath = category === 'menu' && dishCategory
      ? path.join(this.uploadDir, category, dishCategory, filename)
      : path.join(this.uploadDir, category, filename);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code === 'ENOENT') throw createHttpError(404, 'Photo not found');
      throw createHttpError(500, 'Failed to delete photo');
    }
  }

  async getPhotoPath(category: PhotoCategory, filename: string): Promise<string> {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw createHttpError(400, 'Invalid filename');
    }
    const filePath = path.join(this.uploadDir, category, filename);
    try {
      await fs.access(filePath);
      return filePath;
    } catch {
      throw createHttpError(404, 'Photo not found');
    }
  }
}