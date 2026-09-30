import { Router } from 'express';
import { ReportController } from './report.controller.js';

const router = Router();
const controller = new ReportController();

// Mounted behind requireRole(OWNER, CHIEF_ADMIN) in app.ts, and deliberately NOT
// behind requireRestaurant: an owner's own `restaurantId` is null and they own
// several, so the restaurant is resolved per request from what they actually own
// (report.scope.ts). Five reads, no writes — this router has no POST/PATCH at
// all, which is what makes it safe to hand an owner every system's prices.
router.get('/scope', controller.scope.bind(controller));
router.get('/finance', controller.finance.bind(controller));
router.get('/areas', controller.areas.bind(controller));
router.get('/menu', controller.menu.bind(controller));
router.get('/staff', controller.staff.bind(controller));

export { router as reportRouter };
