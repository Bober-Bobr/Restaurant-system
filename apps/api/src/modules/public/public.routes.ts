import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MenuRepository } from '../menu/menu.repository.js';
import { HallRepository } from '../hall/hall.repository.js';
import { ExtraServiceRepository } from '../extraService/extraService.repository.js';
import { TableCategoryRepository } from '../tableCategory/tableCategory.repository.js';
import { RestaurantRepository } from '../restaurant/restaurant.repository.js';
import { generateSummaryPdf } from './pdf.service.js';
import { generateSummaryExcel } from './excel.service.js';
import { InvitationController } from '../invitation/invitation.controller.js';
import { GuestInvitationController } from '../guestInvitation/guestInvitation.controller.js';
import { ReviewController } from '../review/review.controller.js';
import { NfcPlaqueController } from '../nfcPlaque/nfcPlaque.controller.js';
import { PlatformContactService } from '../platformContact/platformContact.service.js';
import { isAllowedImage } from '../../utils/imageUpload.js';
import { InviteRequestService } from '../inviteRequest/inviteRequest.service.js';
import { createInviteRequestSchema } from '../inviteRequest/inviteRequest.schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reviewPhotoUpload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImage(file)) cb(null, true);
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
const guestInvitationController = new GuestInvitationController();
const reviewController = new ReviewController();
const nfcPlaqueController = new NfcPlaqueController();
const platformContactService = new PlatformContactService();
const menuRepository = new MenuRepository();
const hallRepository = new HallRepository();
const tableCategoryRepository = new TableCategoryRepository();
const restaurantRepository = new RestaurantRepository();
const extraServiceRepository = new ExtraServiceRepository();
const inviteRequestService = new InviteRequestService();

router.get('/invitations/:slug', invitationController.publicBySlug.bind(invitationController));
// Flyer "form" block → call-back request for the manager.
router.post('/invitations/:slug/requests', invitationController.submitRequest.bind(invitationController));

// Standalone guest invitations (wedding-style) + RSVP submission.
router.get('/guest-invitations/:slug', guestInvitationController.publicBySlug.bind(guestInvitationController));
router.post('/guest-invitations/:slug/rsvp', guestInvitationController.submitRsvp.bind(guestInvitationController));

// Studio contact details shown under the "developed by" credit on every
// published flyer (vconnect) and v-invite invitation (vinvite).
router.get('/platform-contacts', async (_request, response, next) => {
  try {
    response.json(await platformContactService.listAll());
  } catch (error) { next(error); }
});

// Published NFC plaque behind a tag: v-connect.uz/<slug>.
router.get('/nfc-plaques/:slug', nfcPlaqueController.publicBySlug.bind(nfcPlaqueController));

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

// ── Invitation orders from the Additional Services page ──────────────────────
// Unauthenticated by design: the page is reachable by a restaurant's guest,
// including on a banquet.v-menu.uz/<slug> host with no banquet module. The
// order lands on the v-invite.uz system administrator's Notifications page.
router.post('/invite-requests', async (request, response, next) => {
  try {
    const data = createInviteRequestSchema.parse(request.body);
    response.status(201).json(await inviteRequestService.create(data));
  } catch (error) { next(error); }
});

// The order's optional photos. Uploaded before the order is submitted, exactly
// like the public review-photo flow above. Accepts a batch — the honoree picks
// several at once — and returns the URLs in the order they were sent.
router.post('/invite-request-photo', reviewPhotoUpload.array('file', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) { res.status(400).json({ message: 'No file provided' }); return; }
    const dir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'invite-requests');
    await fs.mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      urls.push(`/uploads/invite-requests/${filename}`);
    }
    // `url` is kept alongside `urls` so a single-file caller still works.
    res.json({ urls, url: urls[0] });
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
      tabletAccentColor: restaurant.tabletAccentColor ?? null,
      tabletBgColor: restaurant.tabletBgColor ?? null,
      tabletParticles: restaurant.tabletParticles ?? null,
      tabletParticlesColor: restaurant.tabletParticlesColor ?? null,
      tabletParticlesImageUrl: restaurant.tabletParticlesImageUrl ?? null,
      tabletTrailTemplate: restaurant.tabletTrailTemplate ?? null,
      tabletTrailColor: restaurant.tabletTrailColor ?? null,
      tabletTrailImageUrl: restaurant.tabletTrailImageUrl ?? null,
      // Which paid products this restaurant has. Public on purpose: the tablet
      // decides whether to offer the Additional Services button, and that flow
      // is unauthenticated.
      moduleBanquet: restaurant.moduleBanquet,
      moduleCatering: restaurant.moduleCatering,
      moduleAddons: restaurant.moduleAddons,
    });
  } catch (error) { next(error); }
});

// Resolve a restaurant from its URL slug and report its module entitlements.
// Powers the banquet-host gate: an unauthenticated visitor at
// banquet.v-menu.uz/<slug> gets the Additional Services page instead of a login
// screen when the restaurant has no banquet module. Deliberately exposes
// nothing beyond identity and the switches.
router.get('/restaurant-modules', async (request, response, next) => {
  try {
    const slug = String(request.query.slug ?? '').trim();
    if (!slug) { response.status(400).json({ message: 'slug required' }); return; }
    const restaurant = await restaurantRepository.findBySlug(slug);
    if (!restaurant) { response.status(404).json({ message: 'Not found' }); return; }
    const company = (restaurant as any).company as { name: string; logoUrl: string | null } | null;
    response.json({
      id: restaurant.id,
      name: restaurant.name,
      logoUrl: restaurant.logoUrl ?? company?.logoUrl ?? null,
      moduleBanquet: restaurant.moduleBanquet,
      moduleCatering: restaurant.moduleCatering,
      moduleAddons: restaurant.moduleAddons,
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

// Additional paid services offered by the restaurant, shown on the tablet Summary page.
router.get('/extra-services', async (request, response, next) => {
  try {
    const restaurantId = String(request.query.restaurantId ?? '');
    if (!restaurantId) { response.json([]); return; }
    response.json(await extraServiceRepository.listActive(restaurantId));
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
