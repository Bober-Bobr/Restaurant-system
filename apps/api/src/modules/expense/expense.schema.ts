import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

export const createDaySchema = z.object({
  date: dateString
});

export const updateDaySchema = z.object({
  allocatedCents: z.number().int().min(0).optional(),
  additionalCents: z.number().int().min(0).optional(),
  additionalNote: z.string().max(500).nullable().optional()
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).optional(),
  unit: z.string().min(1).max(20).optional(),
  amountCents: z.number().int().min(0).optional()
});

export const updateProductSchema = createProductSchema.partial();

export const createSalarySchema = z.object({
  name: z.string().min(1).max(120),
  amountCents: z.number().int().min(0).optional()
});

export const updateSalarySchema = createSalarySchema.partial();

export const idSchema = z.object({ id: z.string().cuid() });
export const dayIdSchema = z.object({ dayId: z.string().cuid() });
