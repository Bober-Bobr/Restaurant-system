import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { TelegramController } from './telegram.controller.js';

const router = Router();
const controller = new TelegramController();
const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

// Public: Telegram posts updates here (secret in the path + header).
router.post('/webhook/:secret', controller.webhook.bind(controller));

// Manager-facing: per-flyer connection status / code / subscribers.
router.get('/flyers/:invitationId/status', adminAuthMiddleware, managerOrChief, controller.status.bind(controller));
router.post('/flyers/:invitationId/rotate', adminAuthMiddleware, managerOrChief, controller.rotate.bind(controller));
router.delete('/flyers/:invitationId/links/:linkId', adminAuthMiddleware, managerOrChief, controller.removeLink.bind(controller));

export { router as telegramRouter };
