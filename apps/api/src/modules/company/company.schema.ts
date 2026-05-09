import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  logoUrl: z.string().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
});
