import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { NfcPlaqueController } from './nfcPlaque.controller.js';

const router = Router();
const controller = new NfcPlaqueController();

// NFC makers are not tied to a restaurant, so these routes carry their own auth
// + role guard rather than sitting under the restaurant-scoped protected router.
const makerOrChief = requireRole(AdminRole.NFC_MAKER, AdminRole.CHIEF_ADMIN);

router.get('/', adminAuthMiddleware, makerOrChief, controller.listMine.bind(controller));
router.get('/slug-available', adminAuthMiddleware, makerOrChief, controller.slugAvailable.bind(controller));
router.get('/:id', adminAuthMiddleware, makerOrChief, controller.getById.bind(controller));
router.post('/', adminAuthMiddleware, makerOrChief, controller.create.bind(controller));
router.patch('/:id', adminAuthMiddleware, makerOrChief, controller.update.bind(controller));
router.delete('/:id', adminAuthMiddleware, makerOrChief, controller.remove.bind(controller));

export { router as nfcPlaqueRouter };
