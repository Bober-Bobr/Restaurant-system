import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { DesignTemplateController } from './designTemplate.controller.js';

const router = Router();
const controller = new DesignTemplateController();

// NFC_MAKER is here for the v-connect plaque designer, which reuses this store
// with kind='plaque'. Every row is owner-scoped, and the controller pins a
// maker's templates to that kind, so the three worlds never see each other.
const managerOrChief = requireRole(AdminRole.CHIEF_ADMIN, AdminRole.MANAGER, AdminRole.NFC_MAKER);

router.get('/', adminAuthMiddleware, managerOrChief, controller.listMine.bind(controller));
router.get('/:id', adminAuthMiddleware, managerOrChief, controller.getById.bind(controller));
router.post('/', adminAuthMiddleware, managerOrChief, controller.create.bind(controller));
router.patch('/:id', adminAuthMiddleware, managerOrChief, controller.update.bind(controller));
router.delete('/:id', adminAuthMiddleware, managerOrChief, controller.remove.bind(controller));

export { router as designTemplateRouter };
