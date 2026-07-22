import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import {
  botConfigured, ensureCode, rotateCode, deepLink, listLinks, deleteLink, handleUpdate,
} from './telegram.service.js';

export class TelegramController {
  // ── Manager-facing (behind admin auth) ────────────────────────────────────
  // Connection status for a flyer: its code, deep link and current subscribers.
  async status(request: Request, response: Response) {
    const invitationId = String(request.params.invitationId);
    if (!botConfigured()) {
      response.json({ enabled: false });
      return;
    }
    const code = await ensureCode(invitationId);
    response.json({
      enabled: true,
      code,
      link: await deepLink(code),
      links: await listLinks(invitationId),
    });
  }

  // Generate a fresh code (revokes existing subscribers).
  async rotate(request: Request, response: Response) {
    const invitationId = String(request.params.invitationId);
    const code = await rotateCode(invitationId);
    response.json({ code, link: await deepLink(code), links: [] });
  }

  async removeLink(request: Request, response: Response) {
    await deleteLink(String(request.params.invitationId), String(request.params.linkId));
    response.json({ ok: true });
  }

  // ── Public webhook (Telegram → us) ─────────────────────────────────────────
  async webhook(request: Request, response: Response) {
    // Always 200 quickly so Telegram does not retry; validate silently.
    response.status(200).json({ ok: true });
    const secretOk = request.params.secret === env.TELEGRAM_WEBHOOK_SECRET
      && request.header('x-telegram-bot-api-secret-token') === env.TELEGRAM_WEBHOOK_SECRET;
    if (!env.TELEGRAM_WEBHOOK_SECRET || !secretOk) return;
    // Never block the response on delivery; log and swallow errors.
    void handleUpdate(request.body ?? {}).catch((err) =>
      console.warn('[telegram] handleUpdate error:', err instanceof Error ? err.message : err));
  }
}
