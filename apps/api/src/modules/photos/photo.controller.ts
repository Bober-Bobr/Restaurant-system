import { Request, Response } from 'express';
import { PhotoService } from './photo.service';

type PhotoCategory = 'menu' | 'hall' | 'table' | 'invitation';
const ALLOWED_CATEGORIES: readonly string[] = ['menu', 'hall', 'table', 'invitation'];

// Roles that own/manage more than one restaurant may target a specific restaurant
// via the request body. Everyone else is pinned to their own assigned restaurant.
function canScopeToAnyRestaurant(role: string | undefined): boolean {
  return role === 'CHIEF_ADMIN' || role === 'MANAGER' || role === 'OWNER';
}

export class PhotoController {
  constructor(private readonly photoService: PhotoService) {}

  async uploadPhotos(req: Request, res: Response) {
    try {
      const { category, dishCategory } = req.body;
      const files = (req.files as any)?.files || [];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const role = req.admin?.role;
      const bodyRestaurantId = typeof req.body.restaurantId === 'string' ? req.body.restaurantId.trim() : '';
      const restaurantId = canScopeToAnyRestaurant(role) && bodyRestaurantId
        ? bodyRestaurantId
        : req.admin?.restaurantId ?? null;
      const urls = await this.photoService.uploadPhotos(
        category as PhotoCategory,
        files,
        restaurantId,
        dishCategory || undefined
      );
      res.json({ urls });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload photos' });
    }
  }

  async uploadAudio(req: Request, res: Response) {
    try {
      const files = (req.files as any)?.files || [];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const role = req.admin?.role;
      const bodyRestaurantId = typeof req.body.restaurantId === 'string' ? req.body.restaurantId.trim() : '';
      const restaurantId = canScopeToAnyRestaurant(role) && bodyRestaurantId
        ? bodyRestaurantId
        : req.admin?.restaurantId ?? null;
      // Stored under the restaurant's `invitation` folder alongside other assets.
      const urls = await this.photoService.uploadPhotos('invitation', files, restaurantId);
      res.json({ urls });
    } catch (error) {
      console.error('Audio upload error:', error);
      res.status(500).json({ error: 'Failed to upload audio' });
    }
  }

  async listPhotos(req: Request, res: Response) {
    try {
      const category = (req.params.category || '') as string;

      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const role = req.admin?.role;
      const queryRestaurantId = typeof req.query.restaurantId === 'string' ? req.query.restaurantId.trim() : '';
      const restaurantId = canScopeToAnyRestaurant(role) && queryRestaurantId
        ? queryRestaurantId
        : req.admin?.restaurantId ?? null;
      const dishCategory = (req.query.dishCategory as string) || undefined;
      const photos = await this.photoService.listPhotos(category as PhotoCategory, restaurantId, dishCategory);
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

      if (!ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }

      const restaurantId = req.admin?.restaurantId ?? null;
      const dishCategory = (req.query.dishCategory as string) || undefined;
      await this.photoService.deletePhoto(category as PhotoCategory, filename, restaurantId, dishCategory);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete photo error:', error);
      if (error instanceof Error && (error as any).status === 404) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      res.status(500).json({ error: 'Failed to delete photo' });
    }
  }
}
