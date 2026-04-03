import { Router } from 'express';
import { TableCategoryController } from './tableCategory.controller.js';

const router = Router();
const controller = new TableCategoryController();

router.get('/', controller.list.bind(controller));
router.post('/', controller.create.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.patch('/:id', controller.update.bind(controller));
router.delete('/:id', controller.remove.bind(controller));

export { router as tableCategoryRouter };
