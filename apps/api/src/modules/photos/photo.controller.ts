import { Request, Response } from 'express';
import { PhotoService } from './photo.service';

type PhotoCategory = 'menu' | 'hall' | 'table';

export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  async uploadPhotos(req: Request, res: Response) {
    try {
      const { category, dishCategory } = req.body;
      const files = (req.files as any)?.files || [];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      if (!['menu', 'hall', 'table'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const urls = await this.photoService.uploadPhotos(
        category as PhotoCategory,
        files,
        dishCategory || undefined
      );
      res.json({ urls });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: 'Failed to upload photos' });
    }
  }

  async listPhotos(req: Request, res: Response) {
    try {
      const category = (req.params.category || '') as string;

      if (!['menu', 'hall', 'table'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const dishCategory = (req.query.dishCategory as string) || undefined;
      const photos = await this.photoService.listPhotos(category as PhotoCategory, dishCategory);
      res.json({ photos });
    } catch (error) {
      console.error('List photos error:', error);
      res.status(500).json({ error: 'Failed to list photos' });
    }
  }

  async deletePhoto(req: Request, res: Response) {
    try {
      const category = (req.params.category || '') as string;
      const filename = (req.params.filename || '') as string;

      if (!['menu', 'hall', 'table'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const dishCategory = (req.query.dishCategory as string) || undefined;
      await this.photoService.deletePhoto(category as PhotoCategory, filename, dishCategory);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete photo error:', error);
      if (error instanceof Error && (error as any).status === 404) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  }

  async servePhoto(req: Request, res: Response) {
    try {
      const category = (req.params.category || '') as string;
      const filename = (req.params.filename || '') as string;

      if (!['menu', 'hall', 'table'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const filePath = await this.photoService.getPhotoPath(category as PhotoCategory, filename);

      // Set appropriate headers for image serving
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.sendFile(filePath);
    } catch (error) {
      console.error('Serve photo error:', error);
      if (error instanceof Error && (error as any).status === 404) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      res.status(500).json({ error: 'Failed to serve photo' });
    }
  }
}