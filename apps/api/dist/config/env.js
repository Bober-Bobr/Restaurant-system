import { z } from 'zod';
const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().int().positive().default(4000),
    JWT_SECRET: z.string().min(32),
    ADMIN_API_KEY: z.string().min(8).optional()
});
export const env = envSchema.parse(process.env);
