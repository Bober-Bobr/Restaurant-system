import { randomInt } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

// ── Telegram forwarding for flyer submissions & invitation RSVPs ─────────────
// Dependency-free Bot API client + the bind/unbind/forward logic. Two bots can
// be configured: the main bot (TELEGRAM_BOT_TOKEN) and an optional dedicated
// invitation bot (TELEGRAM_INVITE_BOT_TOKEN). When the invitation bot is set,
// the main bot handles only flyer codes and the invitation bot only guest
// invitation codes; when unset, the main bot serves both. Everything stays
// dormant while no token is set (botConfigured()).

const API = 'https://api.telegram.org';

export type TgBot = 'main' | 'invite';

/** True when a dedicated invitation bot is configured. */
export function inviteBotSplit(): boolean {
  return Boolean(env.TELEGRAM_INVITE_BOT_TOKEN);
}

function botToken(bot: TgBot): string | undefined {
  // The invitation bot falls back to the main token so guest features keep
  // working on single-bot setups.
  if (bot === 'invite') return env.TELEGRAM_INVITE_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
  return env.TELEGRAM_BOT_TOKEN;
}

/** Which bot serves a given page kind. */
function botFor(kind: TgKind): TgBot {
  return kind === 'guest' && inviteBotSplit() ? 'invite' : 'main';
}

export function botConfigured(kind: TgKind = 'flyer'): boolean {
  return Boolean(botToken(botFor(kind)));
}

/** Raw Bot API call. Returns the parsed `result`, or null on any failure. */
async function tgApi<T = unknown>(bot: TgBot, method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = botToken(bot);
  if (!token) return null;
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
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

async function sendMessage(bot: TgBot, chatId: string, text: string): Promise<void> {
  await tgApi(bot, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
}

// ── Bot username (for t.me deep links) ───────────────────────────────────────
const cachedUsername: Partial<Record<TgBot, string | null>> = {};
export async function getBotUsername(bot: TgBot): Promise<string | null> {
  const configured = bot === 'invite' && inviteBotSplit()
    ? env.TELEGRAM_INVITE_BOT_USERNAME
    : env.TELEGRAM_BOT_USERNAME;
  if (configured) return configured;
  if (cachedUsername[bot]) return cachedUsername[bot]!;
  const me = await tgApi<{ username?: string }>(bot, 'getMe', {});
  cachedUsername[bot] = me?.username ?? null;
  return cachedUsername[bot]!;
}

export async function deepLink(kind: TgKind, code: string): Promise<string | null> {
  const username = await getBotUsername(botFor(kind));
  return username ? `https://t.me/${username}?start=${code}` : null;
}

// ── Subscription targets ─────────────────────────────────────────────────────
// The same code/link machinery serves two kinds of pages, each with its own
// code column and link table: flyers (form submissions) and guest invitations
// (RSVPs). A small delegate per kind keeps the shared logic below generic.
export type TgKind = 'flyer' | 'guest';

type LinkWhere = { invitationId?: string; chatId?: string; id?: string };

const targets: Record<TgKind, {
  noun: string; // used in bot replies
  getCode(id: string): Promise<{ telegramCode: string | null } | null>;
  setCode(id: string, code: string): Promise<unknown>;
  findByCode(code: string): Promise<{ id: string; slug: string } | null>;
  upsertLink(invitationId: string, chatId: string, username: string | null, firstName: string | null): Promise<unknown>;
  listLinks(invitationId: string): Promise<{ id: string; chatId: string; username: string | null; firstName: string | null; createdAt: Date }[]>;
  deleteLinks(where: LinkWhere): Promise<{ count: number }>;
}> = {
  flyer: {
    noun: 'flyer',
    getCode: (id) => prisma.invitation.findUnique({ where: { id }, select: { telegramCode: true } }),
    setCode: (id, code) => prisma.invitation.update({ where: { id }, data: { telegramCode: code } }),
    findByCode: (code) => prisma.invitation.findUnique({ where: { telegramCode: code }, select: { id: true, slug: true } }),
    upsertLink: (invitationId, chatId, username, firstName) => prisma.flyerTelegramLink.upsert({
      where: { invitationId_chatId: { invitationId, chatId } },
      create: { invitationId, chatId, username, firstName },
      update: {},
    }),
    listLinks: (invitationId) => prisma.flyerTelegramLink.findMany({
      where: { invitationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, chatId: true, username: true, firstName: true, createdAt: true },
    }),
    deleteLinks: (where) => prisma.flyerTelegramLink.deleteMany({ where }),
  },
  guest: {
    noun: 'invitation',
    getCode: (id) => prisma.guestInvitation.findUnique({ where: { id }, select: { telegramCode: true } }),
    setCode: (id, code) => prisma.guestInvitation.update({ where: { id }, data: { telegramCode: code } }),
    findByCode: (code) => prisma.guestInvitation.findUnique({ where: { telegramCode: code }, select: { id: true, slug: true } }),
    upsertLink: (invitationId, chatId, username, firstName) => prisma.guestInvitationTelegramLink.upsert({
      where: { invitationId_chatId: { invitationId, chatId } },
      create: { invitationId, chatId, username, firstName },
      update: {},
    }),
    listLinks: (invitationId) => prisma.guestInvitationTelegramLink.findMany({
      where: { invitationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, chatId: true, username: true, firstName: true, createdAt: true },
    }),
    deleteLinks: (where) => prisma.guestInvitationTelegramLink.deleteMany({ where }),
  },
};

// ── Activation code ──────────────────────────────────────────────────────────
// Unambiguous uppercase alphabet (no 0/O/1/I) so codes are easy to relay.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Return the page's code, generating (and persisting) one on first request. */
export async function ensureCode(kind: TgKind, invitationId: string): Promise<string> {
  const target = targets[kind];
  const existing = await target.getCode(invitationId);
  if (!existing) throw new Error('Not found');
  if (existing.telegramCode) return existing.telegramCode;

  // Retry on the (astronomically unlikely) unique collision.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    try {
      await target.setCode(invitationId, code);
      return code;
    } catch {
      // unique violation → try another code
    }
  }
  throw new Error('Could not allocate a Telegram code');
}

/** Rotate to a fresh code and drop all existing links (revokes access). */
export async function rotateCode(kind: TgKind, invitationId: string): Promise<string> {
  const target = targets[kind];
  await target.deleteLinks({ invitationId });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode();
    try {
      await target.setCode(invitationId, code);
      return code;
    } catch {
      /* collision — retry */
    }
  }
  throw new Error('Could not allocate a Telegram code');
}

export function listLinks(kind: TgKind, invitationId: string) {
  return targets[kind].listLinks(invitationId);
}

export async function deleteLink(kind: TgKind, invitationId: string, linkId: string): Promise<void> {
  await targets[kind].deleteLinks({ id: linkId, invitationId });
}

// ── Inbound updates (webhook) ────────────────────────────────────────────────
type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { username?: string; first_name?: string };
  };
};

/** Which page kinds a bot serves: the invitation bot only guest invitations;
 *  the main bot everything, unless the invitation bot took the guest half. */
function botKinds(bot: TgBot): TgKind[] {
  if (bot === 'invite') return ['guest'];
  return inviteBotSplit() ? ['flyer'] : ['flyer', 'guest'];
}

// What the bot's help/stop texts call the things it serves.
function servedNoun(kinds: TgKind[]): string {
  if (kinds.length === 2) return 'flyers and invitations';
  return kinds[0] === 'flyer' ? 'flyers' : 'invitations';
}

export async function handleUpdate(bot: TgBot, update: TgUpdate): Promise<void> {
  const msg = update.message;
  const chatId = msg?.chat?.id;
  const text = (msg?.text ?? '').trim();
  if (chatId == null || !text) return;
  const chat = String(chatId);
  const kinds = botKinds(bot);

  // "/start <code>", a bare code, or "/stop".
  const startMatch = /^\/start(?:@\w+)?(?:\s+(\S+))?/i.exec(text);
  const stopMatch = /^\/stop(?:@\w+)?/i.exec(text);

  if (stopMatch) {
    const removed = await Promise.all(kinds.map((k) => targets[k].deleteLinks({ chatId: chat })));
    const total = removed.reduce((sum, r) => sum + r.count, 0);
    await sendMessage(bot, chat, total > 0
      ? `🔕 You have been unsubscribed from all ${servedNoun(kinds)}.`
      : 'You are not subscribed to anything yet.');
    return;
  }

  // startMatch[1] is undefined for a bare "/start" (bot opened without a deep
  // link) — fall back to '' so we show help instead of throwing.
  const code = ((startMatch ? startMatch[1] : text) || '').trim().toUpperCase();
  if (!code || /^\//.test(code)) {
    const what = kinds.length === 2 ? 'flyer or invitation' : kinds[0] === 'flyer' ? 'flyer' : 'invitation';
    await sendMessage(bot, chat,
      `Send the code shown on your ${what} to start receiving its submissions here.\n\n` +
      'Use /stop to unsubscribe.');
    return;
  }

  // Look the code up only among the kinds this bot serves (codes are
  // unguessable, so order within a bot doesn't matter).
  let kind: TgKind | null = null;
  let page: { id: string; slug: string } | null = null;
  for (const k of kinds) {
    page = await targets[k].findByCode(code);
    if (page) { kind = k; break; }
  }
  if (!page || !kind) {
    await sendMessage(bot, chat, '❌ That code was not recognised. Check the code and try again.');
    return;
  }

  await targets[kind].upsertLink(page.id, chat, msg?.from?.username ?? null, msg?.from?.first_name ?? null);
  await sendMessage(bot, chat, kind === 'flyer'
    ? `✅ Connected to <b>${htmlEscape(page.slug)}</b>.\n`
      + 'New form submissions from this flyer will arrive here. Use /stop to unsubscribe.'
    : `✅ Connected to invitation <b>${htmlEscape(page.slug)}</b>.\n`
      + 'New RSVP responses from this invitation will arrive here. Use /stop to unsubscribe.');
}

// ── Outbound: forward a new submission to every linked chat ───────────────────
export async function forwardSubmission(
  invitationId: string,
  lead: { name: string; phone: string; message?: string | null },
): Promise<void> {
  if (!botConfigured('flyer')) return;
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

  await Promise.all(links.map((l) => sendMessage('main', l.chatId, text)));
}

// ── Outbound: forward a new RSVP to every chat linked to the invitation ───────
export async function forwardRsvp(
  invitationId: string,
  rsvp: { guestName: string; attending: boolean },
): Promise<void> {
  if (!botConfigured('guest')) return;
  const [invitation, links] = await Promise.all([
    prisma.guestInvitation.findUnique({ where: { id: invitationId }, select: { slug: true } }),
    prisma.guestInvitationTelegramLink.findMany({ where: { invitationId }, select: { chatId: true } }),
  ]);
  if (links.length === 0) return;

  const lines = [
    '💌 <b>New RSVP</b>',
    invitation?.slug ? `Invitation: ${htmlEscape(invitation.slug)}` : null,
    `Guest: ${htmlEscape(rsvp.guestName)}`,
    rsvp.attending ? 'Answer: ✅ attending' : 'Answer: ❌ not attending',
  ].filter(Boolean);
  const text = lines.join('\n');

  await Promise.all(links.map((l) => sendMessage(botFor('guest'), l.chatId, text)));
}

// ── Webhook registration (called once on boot) ───────────────────────────────
/** The invitation bot's webhook secret (falls back to the main one). */
export function webhookSecret(bot: TgBot): string | undefined {
  if (bot === 'invite') return env.TELEGRAM_INVITE_WEBHOOK_SECRET || env.TELEGRAM_WEBHOOK_SECRET;
  return env.TELEGRAM_WEBHOOK_SECRET;
}

async function registerBotWebhook(bot: TgBot, path: string): Promise<void> {
  const secret = webhookSecret(bot);
  if (!env.TELEGRAM_PUBLIC_URL || !secret) return;
  const url = `${env.TELEGRAM_PUBLIC_URL.replace(/\/$/, '')}/api/telegram/${path}/${secret}`;
  const ok = await tgApi(bot, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message'],
  });
  if (ok) console.log(`[telegram] ${bot} webhook registered at ${url}`);
}

export async function registerWebhook(): Promise<void> {
  if (env.TELEGRAM_BOT_TOKEN) await registerBotWebhook('main', 'webhook');
  if (inviteBotSplit()) await registerBotWebhook('invite', 'invite-webhook');
}
