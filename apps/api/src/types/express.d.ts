import type { AdminRole } from '@prisma/client';
import type { Section } from '../utils/section.js';

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string; role: AdminRole; restaurantId: string | null; sid?: string | null };
      restaurantId?: string;
      // Which section of the product this request is for — Banquet or Small
      // Banquets. Set by `requireRestaurant` alongside restaurantId, because the
      // two scopes are needed by exactly the same routes and splitting them into
      // two middlewares is an invitation to mount one and forget the other.
      section?: Section;
      // v-invite.uz user context (separate auth world from AdminUser).
      inviteUser?: { id: string; username: string; sid: string | null };
    }
  }
}

export {};
