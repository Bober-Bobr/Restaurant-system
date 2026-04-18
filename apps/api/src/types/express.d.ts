import type { AdminRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string; role: AdminRole; restaurantId: string | null };
      restaurantId?: string;
    }
  }
}

export {};
