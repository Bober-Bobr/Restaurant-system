import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from '../../middleware/auth.middleware.js';
import { CompanyController } from './company.controller.js';

const router = Router();
const controller = new CompanyController();

router.get('/mine', requireRole(AdminRole.OWNER), controller.getMine.bind(controller));
router.post('/', requireRole(AdminRole.OWNER), controller.create.bind(controller));
router.patch('/mine', requireRole(AdminRole.OWNER), controller.update.bind(controller));

export { router as companyRouter };
