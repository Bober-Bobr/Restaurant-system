import { Router } from 'express';
import { AdminRole } from '@prisma/client';
import { requireRole } from '../../middleware/auth.middleware.js';
import { orderController } from './order.controller.js';

// Waiter-side order routes. Mounted under the protected router with
// `requireRestaurant`, so `request.restaurantId` is the waiter's own restaurant
// and a code from another venue simply does not resolve.
//
// CATERING_ADMIN and ADMIN are included so a manager can cover the floor and see
// what is happening, but every handler is still scoped to `request.admin!.id` —
// there is no "see everyone's orders" endpoint here. The restaurant-wide view
// belongs to the statistics pass, where it can be aggregated deliberately.
const waiterRoles = requireRole(
  AdminRole.WAITER,
  AdminRole.CATERING_ADMIN,
  AdminRole.ADMIN,
  AdminRole.CHIEF_ADMIN,
);

const router = Router();

router.get('/mine', waiterRoles, orderController.listMine.bind(orderController));
router.get('/alerts/count', waiterRoles, orderController.alertCount.bind(orderController));
router.post('/claim', waiterRoles, orderController.claim.bind(orderController));
router.patch('/:id', waiterRoles, orderController.update.bind(orderController));
router.post('/:id/acknowledge', waiterRoles, orderController.acknowledgeCall.bind(orderController));
router.post('/:id/close', waiterRoles, orderController.close.bind(orderController));

export { router as orderRouter };
