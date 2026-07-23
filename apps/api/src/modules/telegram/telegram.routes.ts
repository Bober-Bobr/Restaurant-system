import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { inviteAuthMiddleware } from '../vinvite/vinvite.middleware.js';
import { TelegramController } from './telegram.controller.js';

const router = Router();
const controller = new TelegramController();
const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

// Public: Telegram posts updates here (secret in the path + header).
router.post('/webhook/:secret', controller.webhook('main'));
router.post('/invite-webhook/:secret', controller.webhook('invite'));

// Manager-facing: per-flyer connection status / code / subscribers.
router.get('/flyers/:invitationId/status', adminAuthMiddleware, managerOrChief, controller.status('flyer'));
router.post('/flyers/:invitationId/rotate', adminAuthMiddleware, managerOrChief, controller.rotate('flyer'));
router.delete('/flyers/:invitationId/links/:linkId', adminAuthMiddleware, managerOrChief, controller.removeLink('flyer'));

// v-invite.uz owner-facing: same trio for a project's RSVP forwarding. Invite
// auth (not admin) + per-project ownership check inside the controller.
router.get('/vinvite/:invitationId/status', inviteAuthMiddleware, controller.status('vinvite'));
router.post('/vinvite/:invitationId/rotate', inviteAuthMiddleware, controller.rotate('vinvite'));
router.delete('/vinvite/:invitationId/links/:linkId', inviteAuthMiddleware, controller.removeLink('vinvite'));

export { router as telegramRouter };
