import { z } from 'zod';
import { BRANDS } from './platformContact.service.js';

export const platformContactSchema = z.object({
  phone: z.string().max(40).optional(),
  telegram: z.string().max(80).optional(),
});

export const brandParamSchema = z.object({
  brand: z.enum(BRANDS),
});
