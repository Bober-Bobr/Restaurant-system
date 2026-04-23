import { AdminRole } from '@prisma/client';
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .refine(
    (password) => /[A-Z]/.test(password),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (password) => /[a-z]/.test(password),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (password) => /[0-9]/.test(password),
    'Password must contain at least one number'
  );

export const registerSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  password: passwordSchema,
  restaurantName: z.string().min(1).max(100).optional(),
  role: z.nativeEnum(AdminRole).optional(),
  restaurantId: z.string().optional()
});

export const loginSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const updateRoleSchema = z.object({
  role: z.nativeEnum(AdminRole)
});
