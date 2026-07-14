import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { InvitationController } from './invitation.controller.js';

const router = Router();
const controller = new InvitationController();

const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

router.get('/', adminAuthMiddleware, managerOrChief, controller.listByRestaurant.bind(controller));
router.get('/mine', adminAuthMiddleware, managerOrChief, controller.listMine.bind(controller));
router.get('/by-event/:eventId', adminAuthMiddleware, managerOrChief, controller.getByEvent.bind(controller));
router.get('/:id', adminAuthMiddleware, managerOrChief, controller.getById.bind(controller));
router.get('/:id/requests', adminAuthMiddleware, managerOrChief, controller.listRequests.bind(controller));
router.post('/', adminAuthMiddleware, managerOrChief, controller.create.bind(controller));
router.patch('/:id', adminAuthMiddleware, managerOrChief, controller.update.bind(controller));
router.delete('/:id', adminAuthMiddleware, managerOrChief, controller.remove.bind(controller));

export { router as invitationRouter };
