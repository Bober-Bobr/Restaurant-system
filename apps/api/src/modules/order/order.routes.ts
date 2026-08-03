import { Router } from 'express';
import { AdminRole } from '@prisma/client';
import { requireRole } from '../../middleware/auth.middleware.js';
import { orderController } from './order.controller.js';

// Floor-side order routes. Mounted under the protected router with
// `requireRestaurant`, so `request.restaurantId` is the caller's own restaurant
// and a code from another venue simply does not resolve.
//
// CATERING_ADMIN and ADMIN are included so a manager can cover the floor and see
// what is happening, but every handler is still scoped to `request.admin!.id` —
// there is no "see everyone's orders" endpoint here. The restaurant-wide view
// belongs to the statistics pass, where it can be aggregated deliberately.
const floorRoles = requireRole(
  AdminRole.CATERING_EMPLOYEE,
  AdminRole.CATERING_ADMIN,
  AdminRole.ADMIN,
  AdminRole.CHIEF_ADMIN,
);

const router = Router();

router.get('/mine', floorRoles, orderController.listMine.bind(orderController));
router.get('/alerts/count', floorRoles, orderController.alertCount.bind(orderController));
router.post('/claim', floorRoles, orderController.claim.bind(orderController));

// Statistics over CLOSED orders. Read-only, and every one of them is scoped in
// `scopeFor` — a Food Employee sees their own figures whatever they ask for.
router.get('/stats', floorRoles, orderController.stats.bind(orderController));
router.get('/stats/employees', floorRoles, orderController.employeeTotals.bind(orderController));
router.get('/history', floorRoles, orderController.history.bind(orderController));
router.get('/tables', floorRoles, orderController.tables.bind(orderController));
router.patch('/:id', floorRoles, orderController.update.bind(orderController));
router.post('/:id/acknowledge', floorRoles, orderController.acknowledgeCall.bind(orderController));
router.post('/:id/close', floorRoles, orderController.close.bind(orderController));

export { router as orderRouter };
