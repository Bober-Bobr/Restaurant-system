import { z } from 'zod';

/**
 * Every report takes the same four parameters, so they are one schema.
 *
 * `restaurantId` is optional: with none, an OWNER gets every restaurant they own
 * rolled together, which is the question "how is my business doing". Naming one
 * narrows it. Which ids are allowed is NOT decided here — it is decided against
 * the database in `report.scope.ts`, because a schema can only check the shape of
 * a string and ownership is a fact that can change after a token was issued.
 *
 * `tz` is the reader's `-getTimezoneOffset()`, the same value the order
 * statistics send, and it is clamped rather than rejected: a bad offset is a
 * client bug, and refusing the whole report over it would leave an owner with a
 * blank page instead of figures an hour out.
 */
export const reportQuerySchema = z.object({
  restaurantId: z.string().trim().min(1).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  tz: z.coerce.number().int().min(-720).max(840).optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
