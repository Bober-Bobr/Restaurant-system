import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(32),
  ADMIN_API_KEY: z.string().min(8).optional(),
  // OAuth client ID for "Sign in with Google" on v-invite.uz (optional — the
  // Google button is hidden / rejected when unset).
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Telegram bot for forwarding flyer form submissions. The whole feature is
  // dormant unless TELEGRAM_BOT_TOKEN is set. WEBHOOK_SECRET guards the public
  // webhook path; BOT_USERNAME is used to build t.me deep links (auto-fetched
  // via getMe if omitted). PUBLIC_URL is where Telegram should POST updates
  // (e.g. https://event.v-menu.uz) — setWebhook runs on boot when both are set.
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_PUBLIC_URL: z.string().url().optional(),

  // Optional second bot dedicated to guest-invitation RSVPs. When set, the
  // main bot handles only flyers and this one only invitations; when unset,
  // the main bot serves both. The webhook secret falls back to
  // TELEGRAM_WEBHOOK_SECRET when omitted.
  TELEGRAM_INVITE_BOT_TOKEN: z.string().optional(),
  TELEGRAM_INVITE_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_INVITE_BOT_USERNAME: z.string().optional()
});

export const env = envSchema.parse(process.env);
