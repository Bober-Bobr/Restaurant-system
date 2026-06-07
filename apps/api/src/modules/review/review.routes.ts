import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { ReviewController } from './review.controller.js';

const router = Router();
const controller = new ReviewController();

const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

// Manager/Chief: moderate reviews.
router.get('/', adminAuthMiddleware, managerOrChief, controller.listAll.bind(controller));
router.patch('/:id/approve', adminAuthMiddleware, managerOrChief, controller.setApproved.bind(controller));
router.delete('/:id', adminAuthMiddleware, managerOrChief, controller.remove.bind(controller));

export { router as reviewRouter };
