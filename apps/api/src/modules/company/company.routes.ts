import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from '../../middleware/auth.middleware.js';
import { CompanyController } from './company.controller.js';

const router = Router();
const controller = new CompanyController();

// Chief Admin: see and delete any company
router.get('/', requireRole(AdminRole.CHIEF_ADMIN), controller.listAll.bind(controller));

// Owner: list / create / update / delete their own companies
router.get('/mine', requireRole(AdminRole.OWNER), controller.listMine.bind(controller));
router.post('/', requireRole(AdminRole.OWNER), controller.create.bind(controller));
router.patch('/:id', requireRole(AdminRole.OWNER, AdminRole.CHIEF_ADMIN), controller.updateOwn.bind(controller));
router.delete('/:id', requireRole(AdminRole.OWNER, AdminRole.CHIEF_ADMIN), controller.deleteOwn.bind(controller));

export { router as companyRouter };
