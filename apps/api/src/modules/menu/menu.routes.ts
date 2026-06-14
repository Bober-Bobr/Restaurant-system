import { Router } from 'express';
import { MenuController } from './menu.controller.js';

const router = Router();
const controller = new MenuController();

router.get('/', controller.list.bind(controller));
router.get('/admin/all', controller.listAll.bind(controller));
router.get('/settings', controller.getSettings.bind(controller));
router.put('/settings', controller.saveSettings.bind(controller));
router.post('/', controller.create.bind(controller));
router.put('/arrangement', controller.saveArrangement.bind(controller));
router.delete('/:menuItemId', controller.remove.bind(controller));
router.patch('/:menuItemId', controller.update.bind(controller));
router.post('/events/:eventId/selections', controller.assignSelection.bind(controller));

export { router as menuRouter };
