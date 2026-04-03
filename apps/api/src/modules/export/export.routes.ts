import { Router } from 'express';
import { ExportController } from './export.controller.js';

const router = Router();
const controller = new ExportController();

router.get('/events/:eventId/excel', controller.excel.bind(controller));
router.get('/events/:eventId/pdf', controller.pdf.bind(controller));

export { router as exportRouter };
