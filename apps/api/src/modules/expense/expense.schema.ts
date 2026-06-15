import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// Whole so'm; capped at one billion so values stay within the 32-bit Int range.
const MAX_SUM = 1_000_000_000;
const sum = z.number().int().min(0).max(MAX_SUM);

export const createDaySchema = z.object({
  date: dateString.optional()
});

export const updateDaySchema = z.object({
  allocatedSum: sum.optional()
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).max(1_000_000).optional(),
  unit: z.string().min(1).max(20).optional(),
  amountSum: sum.optional()
});

export const updateProductSchema = createProductSchema.partial();

// Salaries and additional expenses share the same { name, amountSum } shape.
export const createLineSchema = z.object({
  name: z.string().min(1).max(120),
  amountSum: sum.optional()
});

export const updateLineSchema = createLineSchema.partial();

export const idSchema = z.object({ id: z.string().cuid() });
export const dayIdSchema = z.object({ dayId: z.string().cuid() });

export const pdfQuerySchema = z.object({
  from: dateString.optional(),
  to: dateString.optional()
});
