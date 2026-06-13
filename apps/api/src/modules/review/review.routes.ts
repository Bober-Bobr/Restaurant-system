import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { ReviewController } from './review.controller.js';

const router = Router();
const controller = new ReviewController();

const canModerateReviews = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.OWNER, AdminRole.CATERING_ADMIN);

// Owner/Chief/FoodAdmin: moderate reviews.
router.get('/', adminAuthMiddleware, canModerateReviews, controller.listAll.bind(controller));
router.patch('/:id/approve', adminAuthMiddleware, canModerateReviews, controller.setApproved.bind(controller));
router.delete('/:id', adminAuthMiddleware, canModerateReviews, controller.remove.bind(controller));

export { router as reviewRouter };
