import { Router } from 'express';
import { MenuRepository } from '../menu/menu.repository.js';
import { HallRepository } from '../hall/hall.repository.js';
import { TableCategoryRepository } from '../tableCategory/tableCategory.repository.js';
import { generateSummaryPdf } from './pdf.service.js';
import { generateSummaryExcel } from './excel.service.js';

const router = Router();
const menuRepository = new MenuRepository();
const hallRepository = new HallRepository();
const tableCategoryRepository = new TableCategoryRepository();

router.get('/menu-items', async (request, response, next) => {
  try {
    const restaurantId = String(request.query.restaurantId ?? '');
    if (!restaurantId) { response.json([]); return; }
    response.json(await menuRepository.listActive(restaurantId));
  } catch (error) { next(error); }
});

router.get('/halls', async (request, response, next) => {
  try {
    const restaurantId = String(request.query.restaurantId ?? '');
    if (!restaurantId) { response.json([]); return; }
    response.json(await hallRepository.listActive(restaurantId));
  } catch (error) { next(error); }
});

router.get('/table-categories', async (request, response, next) => {
  try {
    const restaurantId = String(request.query.restaurantId ?? '');
    if (!restaurantId) { response.json([]); return; }
    response.json(await tableCategoryRepository.listActive(restaurantId));
  } catch (error) { next(error); }
});

router.post('/export/pdf', async (request, response, next) => {
  try {
    const pdfBuffer = await generateSummaryPdf(request.body);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="selection-summary.pdf"');
    response.send(pdfBuffer);
  } catch (error) { next(error); }
});

router.post('/export/excel', async (request, response, next) => {
  try {
    const excelBuffer = await generateSummaryExcel(request.body);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="selection-summary.xlsx"');
    response.send(excelBuffer);
  } catch (error) { next(error); }
});

export { router as publicApiRouter };
