import { Router } from 'express';
import { SubcategoryController } from './subcategory.controller.js';

const router = Router();
const controller = new SubcategoryController();

router.get('/', controller.list.bind(controller));
router.put('/arrangement', controller.saveArrangement.bind(controller));
router.post('/', controller.create.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export { router as subcategoryRouter };
