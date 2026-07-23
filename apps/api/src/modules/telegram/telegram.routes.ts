import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
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

// Manager-facing: same for guest invitations (RSVP forwarding).
router.get('/invitations/:invitationId/status', adminAuthMiddleware, managerOrChief, controller.status('guest'));
router.post('/invitations/:invitationId/rotate', adminAuthMiddleware, managerOrChief, controller.rotate('guest'));
router.delete('/invitations/:invitationId/links/:linkId', adminAuthMiddleware, managerOrChief, controller.removeLink('guest'));

export { router as telegramRouter };
