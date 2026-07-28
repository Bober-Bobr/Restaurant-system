import { AdminRole } from '@prisma/client';
import { Router } from 'express';
import { adminAuthMiddleware, requireRole } from '../../middleware/auth.middleware.js';
import { PlatformContactService } from './platformContact.service.js';
import { platformContactSchema } from './platformContact.schema.js';

const router = Router();
const service = new PlatformContactService();

// v-menu side: the v-connect contact block on flyers. Managers own the flyer
// builder, so they own these details too; CHIEF_ADMIN keeps access as the
// platform superadmin.
// (The v-invite brand is edited through /api/vinvite/platform-contact by a
// SYSTEM_ADMIN — a different auth world entirely, so it lives in that router.)
const managerOrChief = requireRole(AdminRole.MANAGER, AdminRole.CHIEF_ADMIN);

router.get('/', adminAuthMiddleware, managerOrChief, async (_req, res, next) => {
  try {
    res.json(await service.get('vconnect'));
  } catch (e) { next(e); }
});

router.patch('/', adminAuthMiddleware, managerOrChief, async (req, res, next) => {
  try {
    const payload = platformContactSchema.parse(req.body);
    res.json(await service.upsert('vconnect', payload));
  } catch (e) { next(e); }
});

export { router as platformContactRouter };
