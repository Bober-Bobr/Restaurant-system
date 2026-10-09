import { z } from 'zod';

/**
 * How many photos one hall may hold.
 *
 * Exported because the picker on the web has to stop at the same number: a
 * gallery that let somebody choose a 31st photo would lose the whole save to a
 * 400, taking the thirty they had already arranged with it.
 * `apps/web/src/utils/hallPhotos.test.ts` imports both copies.
 */
export const MAX_HALL_PHOTOS = 30;

export const createHallSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().int().positive().max(5000),
  description: z.string().max(500).optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  photos: z.array(z.string()).max(MAX_HALL_PHOTOS).optional(),
  isActive: z.boolean().optional()
});

export const updateHallSchema = createHallSchema.partial();

export const hallIdSchema = z.object({
  id: z.string().cuid()
});
