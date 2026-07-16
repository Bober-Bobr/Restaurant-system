import type { AdminRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string; role: AdminRole; restaurantId: string | null; sid?: string | null };
      restaurantId?: string;
      // v-invite.uz user context (separate auth world from AdminUser).
      inviteUser?: { id: string; username: string; sid: string | null };
    }
  }
}

export {};
