import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from '../../middleware/auth.middleware.js';
import { EventController } from './event.controller.js';

const router = Router();
const controller = new EventController();

// All authenticated roles (incl. EMPLOYEE) can read events
router.get('/', controller.list.bind(controller));
router.get('/:eventId', controller.getById.bind(controller));

// Only ADMIN+ can mutate
router.post('/', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.create.bind(controller));
router.patch('/:eventId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.update.bind(controller));
router.post('/:eventId/reschedule', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.reschedule.bind(controller));
router.post('/:eventId/payments', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.addPayment.bind(controller));
router.delete('/:eventId/payments/:paymentId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.removePayment.bind(controller));
router.delete('/:eventId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN), controller.remove.bind(controller));

export { router as eventRouter };
