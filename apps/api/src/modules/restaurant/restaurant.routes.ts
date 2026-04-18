import { Router } from 'express';
import { requireRole } from '../../middleware/auth.middleware.js';
import { RestaurantController } from './restaurant.controller.js';
import { AdminRole } from '@prisma/client';

const router = Router();
const controller = new RestaurantController();

// GET / — OWNER sees all their restaurants; ADMIN/EMPLOYEE see their assigned restaurant
router.get('/', controller.list.bind(controller));

// Mutations are OWNER-only
router.post('/', requireRole(AdminRole.OWNER), controller.create.bind(controller));
router.patch('/:id', requireRole(AdminRole.OWNER), controller.update.bind(controller));
router.delete('/:id', requireRole(AdminRole.OWNER), controller.remove.bind(controller));

export { router as restaurantRouter };
