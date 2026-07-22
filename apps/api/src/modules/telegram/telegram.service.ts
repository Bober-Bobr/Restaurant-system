import { randomInt } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

// ── Telegram forwarding for flyer form submissions ───────────────────────────
// Dependency-free Bot API client + the bind/unbind/forward logic. The whole
// feature stays dormant when TELEGRAM_BOT_TOKEN is unset (botConfigured()).

const API = 'https://api.telegram.org';

export function botConfigured(): boolean {
  return Boolean(env.TELEGRAM_BOT_TOKEN);
}

/** Raw Bot API call. Returns the parsed `result`, or null on any failure. */
async function tgApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.warn(`[telegram] ${method} failed: ${json.description ?? res.status}`);
      return null;
    }
    return json.result ?? null;
  } catch (err) {
    console.warn(`[telegram] ${method} error:`, err instanceof Error ? err.message : err);
    return null;
  }
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function sendMessage(chatId: string, text: string): Promise<void> {
  await tgApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
}

// ── Bot username (for t.me deep links) ───────────────────────────────────────
let cachedUsername: string | null = null;
export async function getBotUsername(): Promise<string | null> {
  if (env.TELEGRAM_BOT_USERNAME) return env.TELEGRAM_BOT_USERNAME;
  if (cachedUsername) return cachedUsername;
  const me = await tgApi<{ username?: string }>('getMe', {});
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}

export async function deepLink(code: string): Promise<string | null> {
  const username = await getBotUsername();
  return username ? `https://t.me/${username}?start=${code}` : null;
}

// ── Activation code ──────────────────────────────────────────────────────────
// Unambiguous uppercase alphabet (no 0/O/1/I) so codes are easy to relay.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Return the flyer's code, generating (and persisting) one on first request. */
export async function ensureCode(invitationId: string): Promise<string> {
  const existing = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { telegramCode: true },
  });
  if (!existing) throw new Error('Flyer not found');
  if (existing.telegramCode) return existing.telegramCode;

  // Retry on the (astronomically unlikely) unique collision.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    try {
      await prisma.invitation.update({ where: { id: invitationId }, data: { telegramCode: code } });
      return code;
    } catch {
      // unique violation → try another code
    }
  }
  throw new Error('Could not allocate a Telegram code');
}

/** Rotate to a fresh code and drop all existing links (revokes access). */
export async function rotateCode(invitationId: string): Promise<string> {
  await prisma.flyerTelegramLink.deleteMany({ where: { invitationId } });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    try {
      await prisma.invitation.update({ where: { id: invitationId }, data: { telegramCode: code } });
      return code;
    } catch {
      /* collision — retry */
    }
  }
  throw new Error('Could not allocate a Telegram code');
}

export function listLinks(invitationId: string) {
  return prisma.flyerTelegramLink.findMany({
    where: { invitationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, chatId: true, username: true, firstName: true, createdAt: true },
  });
}

export async function deleteLink(invitationId: string, linkId: string): Promise<void> {
  await prisma.flyerTelegramLink.deleteMany({ where: { id: linkId, invitationId } });
}

// ── Inbound updates (webhook) ────────────────────────────────────────────────
type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string; first_name?: string };
  };
};

export async function handleUpdate(update: TgUpdate): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? '').trim();
  if (chatId == null || !text) return;
  const chat = String(chatId);

  // "/start <code>", a bare code, or "/stop".
  const startMatch = /^\/start(?:@\w+)?(?:\s+(\S+))?/i.exec(text);
  const stopMatch = /^\/stop(?:@\w+)?/i.exec(text);

  if (stopMatch) {
    const removed = await prisma.flyerTelegramLink.deleteMany({ where: { chatId: chat } });
    await sendMessage(chat, removed.count > 0
      ? '🔕 You have been unsubscribed from all flyers.'
      : 'You are not subscribed to any flyer.');
    return;
  }

  // startMatch[1] is undefined for a bare "/start" (bot opened without a deep
  // link) — fall back to '' so we show help instead of throwing.
  const code = ((startMatch ? startMatch[1] : text) || '').trim().toUpperCase();
  if (!code || /^\//.test(code)) {
    await sendMessage(chat,
      'Send the code shown on your flyer to start receiving its form submissions here.\n\n' +
      'Use /stop to unsubscribe.');
    return;
  }

  const flyer = await prisma.invitation.findUnique({
    where: { telegramCode: code },
    select: { id: true, slug: true },
  });
  if (!flyer) {
    await sendMessage(chat, '❌ That code was not recognised. Check the code on your flyer and try again.');
    return;
  }

  await prisma.flyerTelegramLink.upsert({
    where: { invitationId_chatId: { invitationId: flyer.id, chatId: chat } },
    create: {
      invitationId: flyer.id,
      chatId: chat,
      username: msg?.from?.username ?? null,
      firstName: msg?.from?.first_name ?? null,
    },
    update: {},
  });
  await sendMessage(chat,
    `✅ Connected to <b>${htmlEscape(flyer.slug)}</b>.\n` +
    'New form submissions from this flyer will arrive here. Use /stop to unsubscribe.');
}

// ── Outbound: forward a new submission to every linked chat ───────────────────
export async function forwardSubmission(
  invitationId: string,
  lead: { name: string; phone: string; message?: string | null },
): Promise<void> {
  if (!botConfigured()) return;
  const [flyer, links] = await Promise.all([
    prisma.invitation.findUnique({ where: { id: invitationId }, select: { slug: true } }),
    prisma.flyerTelegramLink.findMany({ where: { invitationId }, select: { chatId: true } }),
  ]);
  if (links.length === 0) return;

  const lines = [
    '📩 <b>New flyer submission</b>',
    flyer?.slug ? `Flyer: ${htmlEscape(flyer.slug)}` : null,
    `Name: ${htmlEscape(lead.name)}`,
    `Phone: ${htmlEscape(lead.phone)}`,
    lead.message ? `Message: ${htmlEscape(lead.message)}` : null,
  ].filter(Boolean);
  const text = lines.join('\n');

  await Promise.all(links.map((l) => sendMessage(l.chatId, text)));
}

// ── Webhook registration (called once on boot) ───────────────────────────────
export async function registerWebhook(): Promise<void> {
  if (!botConfigured() || !env.TELEGRAM_PUBLIC_URL || !env.TELEGRAM_WEBHOOK_SECRET) return;
  const url = `${env.TELEGRAM_PUBLIC_URL.replace(/\/$/, '')}/api/telegram/webhook/${env.TELEGRAM_WEBHOOK_SECRET}`;
  const ok = await tgApi('setWebhook', {
    url,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message'],
  });
  if (ok) console.log(`[telegram] webhook registered at ${url}`);
}
