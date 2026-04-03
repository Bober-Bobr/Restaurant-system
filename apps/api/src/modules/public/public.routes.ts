import { Router } from 'express';
import { MenuRepository } from '../menu/menu.repository.js';
import { HallRepository } from '../hall/hall.repository.js';
import { TableCategoryRepository } from '../tableCategory/tableCategory.repository.js';

const router = Router();
const menuRepository = new MenuRepository();
const hallRepository = new HallRepository();
const tableCategoryRepository = new TableCategoryRepository();

router.get('/menu-items', async (_request, response, next) => {
  try {
    const items = await menuRepository.listActive();
    response.json(items);
  } catch (error) {
    next(error);
  }
});

router.get('/halls', async (_request, response, next) => {
  try {
    const halls = await hallRepository.listActive();
    response.json(halls);
  } catch (error) {
    next(error);
  }
});

router.get('/table-categories', async (_request, response, next) => {
  try {
    const tableCategories = await tableCategoryRepository.listActive();
    response.json(tableCategories);
  } catch (error) {
    next(error);
  }
});

export { router as publicApiRouter };
