import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MenuRepository } from '../menu/menu.repository.js';
import { HallRepository } from '../hall/hall.repository.js';
import { TableCategoryRepository } from '../tableCategory/tableCategory.repository.js';
import { RestaurantRepository } from '../restaurant/restaurant.repository.js';
import { generateSummaryPdf } from './pdf.service.js';
import { generateSummaryExcel } from './excel.service.js';
import { InvitationController } from '../invitation/invitation.controller.js';
import { ReviewController } from '../review/review.controller.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewPhotoUpload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// Category order is stored as a JSON array string; parse defensively for the public API.
function parseCategoryOrder(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

const router = Router();
const invitationController = new InvitationController();
const reviewController = new ReviewController();
const menuRepository = new MenuRepository();
const hallRepository = new HallRepository();
const tableCategoryRepository = new TableCategoryRepository();
const restaurantRepository = new RestaurantRepository();

router.get('/invitations/:slug', invitationController.publicBySlug.bind(invitationController));

// Public reviews: submit + list approved.
router.post('/reviews', reviewController.create.bind(reviewController));
router.get('/reviews', reviewController.listApproved.bind(reviewController));

// Public review photo upload (no auth — photo is uploaded before review is submitted).
router.post('/review-photo', reviewPhotoUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'No file provided' }); return; }
    const dir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'reviews');
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await fs.writeFile(path.join(dir, filename), req.file.buffer);
    res.json({ url: `/uploads/reviews/${filename}` });
  } catch (err) { next(err); }
});

router.get('/restaurants', async (_request, response, next) => {
  try {
    const list = await restaurantRepository.listAllPublic();
    response.json(list.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address ?? null,
      phone: r.phone ?? null,
      email: r.email ?? null,
      history: r.history ?? null,
      logoUrl: r.logoUrl ?? r.company?.logoUrl ?? null,
      backgroundImageUrl: r.backgroundImageUrl ?? null,
      categoryOrder: parseCategoryOrder(r.categoryOrder),
      hideSubcategories: r.hideSubcategories ?? false,
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
