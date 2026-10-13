import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, optionalAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { AuthController } from './auth.controller.js';

const router = Router();
const controller = new AuthController();

router.post('/register', optionalAuthMiddleware, controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.post('/refresh', controller.refresh.bind(controller));
router.post('/logout', adminAuthMiddleware, controller.logout.bind(controller));
router.get('/me', adminAuthMiddleware, controller.me.bind(controller));

// Devices / sessions — any authenticated user manages their own.
router.get('/sessions', adminAuthMiddleware, controller.listSessions.bind(controller));
router.delete('/sessions/:id', adminAuthMiddleware, controller.revokeSession.bind(controller));

router.get('/users', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.listUsers.bind(controller));
router.delete('/users/:id', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.deleteUser.bind(controller));
router.patch('/users/:id/role', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER), controller.updateRole.bind(controller));
router.patch('/users/:id/restaurant', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN), controller.updateRestaurant.bind(controller));
// Which floor somebody works. `:id` may be `me`, because moving yourself and
// being moved by your manager are the same act with the same rule — see
// `canSetWorkArea` in utils/workArea.ts, which the handler applies and which
// the web shares so the switch and the endpoint cannot disagree.
//
// The route itself is open to any signed-in account on purpose: the rule is
// about the TARGET's role and the caller's standing over it, and a requireRole
// list here would be a second, coarser copy of that rule to keep in step.
router.patch('/users/:id/work-area', adminAuthMiddleware, controller.updateWorkArea.bind(controller));
router.patch('/users/:id/credentials', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.updateCredentials.bind(controller));
router.post('/users', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.createUserAsChief.bind(controller));

export { router as authRouter };
