import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { GuestInvitationController } from './guestInvitation.controller.js';

const router = Router();
const controller = new GuestInvitationController();

const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

router.get('/', adminAuthMiddleware, managerOrChief, controller.listMine.bind(controller));
router.get('/:id', adminAuthMiddleware, managerOrChief, controller.getById.bind(controller));
router.get('/:id/rsvps', adminAuthMiddleware, managerOrChief, controller.listRsvps.bind(controller));
router.post('/', adminAuthMiddleware, managerOrChief, controller.create.bind(controller));
router.patch('/:id', adminAuthMiddleware, managerOrChief, controller.update.bind(controller));
router.delete('/:id', adminAuthMiddleware, managerOrChief, controller.remove.bind(controller));

export { router as guestInvitationRouter };
