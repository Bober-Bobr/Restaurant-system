import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { DesignTemplateController } from './designTemplate.controller.js';

const router = Router();
const controller = new DesignTemplateController();

const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER);

router.get('/', adminAuthMiddleware, managerOrChief, controller.listMine.bind(controller));
router.post('/', adminAuthMiddleware, managerOrChief, controller.create.bind(controller));
router.delete('/:id', adminAuthMiddleware, managerOrChief, controller.remove.bind(controller));

export { router as designTemplateRouter };
