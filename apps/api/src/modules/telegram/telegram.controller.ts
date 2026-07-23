import type { Request, Response } from 'express';
import {
  botConfigured, ensureCode, rotateCode, deepLink, listLinks, deleteLink, handleUpdate,
  webhookSecret, type TgBot, type TgKind,
} from './telegram.service.js';

export class TelegramController {
  // ── Manager-facing (behind admin auth) ────────────────────────────────────
  // The same endpoints serve flyers ('flyer') and guest invitations ('guest');
  // routes bind the kind.

  // Connection status: the page's code, deep link and current subscribers.
  status(kind: TgKind) {
    return async (request: Request, response: Response) => {
      const invitationId = String(request.params.invitationId);
      if (!botConfigured(kind)) {
        response.json({ enabled: false });
        return;
      }
      const code = await ensureCode(kind, invitationId);
      response.json({
        enabled: true,
        code,
        link: await deepLink(kind, code),
        links: await listLinks(kind, invitationId),
      });
    };
  }

  // Generate a fresh code (revokes existing subscribers).
  rotate(kind: TgKind) {
    return async (request: Request, response: Response) => {
      const invitationId = String(request.params.invitationId);
      const code = await rotateCode(kind, invitationId);
      response.json({ code, link: await deepLink(kind, code), links: [] });
    };
  }

  removeLink(kind: TgKind) {
    return async (request: Request, response: Response) => {
      await deleteLink(kind, String(request.params.invitationId), String(request.params.linkId));
      response.json({ ok: true });
    };
  }

  // ── Public webhook (Telegram → us) ─────────────────────────────────────────
  // One route per bot: 'main' (flyers, and invitations while no dedicated
  // invitation bot exists) and 'invite' (the dedicated invitation bot).
  webhook(bot: TgBot) {
    return (request: Request, response: Response) => {
      // Always 200 quickly so Telegram does not retry; validate silently.
      response.status(200).json({ ok: true });
      const secret = webhookSecret(bot);
      const secretOk = request.params.secret === secret
        && request.header('x-telegram-bot-api-secret-token') === secret;
      if (!secret || !secretOk) return;
      // Never block the response on delivery; log and swallow errors.
      void handleUpdate(bot, request.body ?? {}).catch((err) =>
        console.warn('[telegram] handleUpdate error:', err instanceof Error ? err.message : err));
    };
  }
}
