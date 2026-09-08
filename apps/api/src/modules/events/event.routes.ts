import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from '../../middleware/auth.middleware.js';
import { EventController } from './event.controller.js';

const router = Router();
const controller = new EventController();

// All authenticated roles (incl. EMPLOYEE) can read events
router.get('/', controller.list.bind(controller));
router.get('/:eventId', controller.getById.bind(controller));

// Only ADMIN+ can mutate. SUPERVISOR is in the list on the same footing as
// ADMIN — the Small Banquets section has the same capabilities — and the rows
// it can touch are confined to its own section by `requireRestaurant`, not by
// this line.
router.post('/', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.create.bind(controller));
router.patch('/:eventId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.update.bind(controller));
router.post('/:eventId/reschedule', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.reschedule.bind(controller));
router.post('/:eventId/payments', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.addPayment.bind(controller));
router.delete('/:eventId/payments/:paymentId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.removePayment.bind(controller));
router.delete('/:eventId', requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.SUPERVISOR), controller.remove.bind(controller));

export { router as eventRouter };
