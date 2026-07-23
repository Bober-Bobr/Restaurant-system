import type { Request, Response } from 'express';
import createHttpError from 'http-errors';
import {
  botConfigured, ensureCode, rotateCode, deepLink, listLinks, deleteLink, handleUpdate,
  webhookSecret, vinviteProjectOwned, type TgBot, type TgKind,
} from './telegram.service.js';

// Flyer routes are guarded by the MANAGER/CHIEF role; v-invite routes only by
// invite auth, so each project must additionally be checked against its owner.
async function assertAccess(kind: TgKind, request: Request, id: string): Promise<void> {
  if (kind !== 'vinvite') return;
  const userId = request.inviteUser?.id;
  if (!userId || !(await vinviteProjectOwned(id, userId))) throw createHttpError(404, 'Not found');
}

export class TelegramController {
  // ── Owner-facing (flyers behind admin auth, projects behind invite auth) ──
  // The same endpoints serve flyers ('flyer') and v-invite projects
  // ('vinvite'); routes bind the kind.

  // Connection status: the page's code, deep link and current subscribers.
  status(kind: TgKind) {
    return async (request: Request, response: Response) => {
      const invitationId = String(request.params.invitationId);
      await assertAccess(kind, request, invitationId);
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
      await assertAccess(kind, request, invitationId);
      const code = await rotateCode(kind, invitationId);
      response.json({ code, link: await deepLink(kind, code), links: [] });
    };
  }

  removeLink(kind: TgKind) {
    return async (request: Request, response: Response) => {
      const invitationId = String(request.params.invitationId);
      await assertAccess(kind, request, invitationId);
      await deleteLink(kind, invitationId, String(request.params.linkId));
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
