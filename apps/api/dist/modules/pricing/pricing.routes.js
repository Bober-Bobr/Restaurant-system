import { Router } from 'express';
import { PricingController } from './pricing.controller.js';
const router = Router();
const controller = new PricingController();
router.get('/events/:eventId', controller.getPricing.bind(controller));
export { router as pricingRouter };
