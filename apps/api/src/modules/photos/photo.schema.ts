import { z } from 'zod';

// Simplified schema validation for photo categories
export const photoCategorySchema = z.enum(['menu', 'hall', 'table']);

export type PhotoCategory = z.infer<typeof photoCategorySchema>;