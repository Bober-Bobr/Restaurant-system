import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(32),
  ADMIN_API_KEY: z.string().min(8).optional(),
  // OAuth client ID for "Sign in with Google" on v-invite.uz (optional — the
  // Google button is hidden / rejected when unset).
  GOOGLE_CLIENT_ID: z.string().optional()
});

export const env = envSchema.parse(process.env);
