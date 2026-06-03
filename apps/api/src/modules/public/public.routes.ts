import { Router } from 'express';
import { MenuRepository } from '../menu/menu.repository.js';
import { HallRepository } from '../hall/hall.repository.js';
import { TableCategoryRepository } from '../tableCategory/tableCategory.repository.js';
import { RestaurantRepository } from '../restaurant/restaurant.repository.js';
import { generateSummaryPdf } from './pdf.service.js';
import { generateSummaryExcel } from './excel.service.js';
import { InvitationController } from '../invitation/invitation.controller.js';

const router = Router();
const invitationController = new InvitationController();
const menuRepository = new MenuRepository();
const hallRepository = new HallRepository();
const tableCategoryRepository = new TableCategoryRepository();
const restaurantRepository = new RestaurantRepository();

router.get('/invitations/:slug', invitationController.publicBySlug.bind(invitationController));

router.get('/restaurants', async (_request, response, next) => {
  try {
    const list = await restaurantRepository.listAllPublic();
    response.json(list.map((r) => ({
      id: r.id,
      name: r.name,
      logoUrl: r.logoUrl ?? r.company?.logoUrl ?? null,
      companyName: r.company?.name ?? null,
    })));
  } catch (error) { next(error); }
});

router.get('/restaurant', async (request, response, next) => {
  try {
    const restaurantId = String(request.query.restaurantId ?? '');
    if (!restaurantId) { response.status(400).json({ message: 'restaurantId required' }); return; }
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) { response.status(404).json({ message: 'Not found' }); return; }
    const company = (restaurant as any).company as { id: string; name: string; logoUrl: string | null } | null;
    response.json({
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl ?? company?.logoUrl ?? null,
      companyName: company?.name ?? null,
    });
  } catch (error) { next(error); }
});

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
