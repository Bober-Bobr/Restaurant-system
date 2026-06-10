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
router.patch('/users/:id/credentials', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.updateCredentials.bind(controller));
router.post('/users', adminAuthMiddleware, requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATERING_ADMIN), controller.createUserAsChief.bind(controller));

export { router as authRouter };
