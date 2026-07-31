import { Router } from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdminRole } from '@prisma/client';
import { requireRole } from '../../middleware/auth.middleware.js';
import { PerformerController } from './performer.controller.js';
import { isAllowedImage } from '../../utils/imageUpload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const controller = new PerformerController();

// Performer and host media lives outside the restaurant-scoped photo service —
// neither belongs to a restaurant, so that service has nowhere to put it.
const mediaUpload = multer({
  limits: { fileSize: 60 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImage(file) || file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only image or video files are allowed'));
  },
});

// Hosts share this whole workspace with performers — same profile, calendar and
// booking inbox, still scoped to the caller's own id inside every handler.
const performerOnly = requireRole(AdminRole.PERFORMER, AdminRole.HOST);

router.get('/me', performerOnly, controller.getMyProfile.bind(controller));
router.patch('/me', performerOnly, controller.updateMyProfile.bind(controller));

router.get('/me/events', performerOnly, controller.listMyEvents.bind(controller));
router.post('/me/events', performerOnly, controller.createMyEvent.bind(controller));
router.patch('/me/events/:id', performerOnly, controller.updateMyEvent.bind(controller));
router.delete('/me/events/:id', performerOnly, controller.removeMyEvent.bind(controller));

router.get('/me/bookings', performerOnly, controller.listMyBookings.bind(controller));
router.get('/me/bookings/pending-count', performerOnly, controller.myPendingCount.bind(controller));
router.patch('/me/bookings/:id', performerOnly, controller.decideBooking.bind(controller));

// Avatar / gallery / showreel uploads. Stored per performer so deleting an
// account's files later is a single directory removal.
router.post('/me/media', performerOnly, mediaUpload.array('file', 10), async (req, res, next) => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) { res.status(400).json({ message: 'No file provided' }); return; }
    const dir = path.resolve(__dirname, '..', '..', '..', 'uploads', 'performers', req.admin!.id);
    await fs.mkdir(dir, { recursive: true });
    const urls: string[] = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      await fs.writeFile(path.join(dir, filename), file.buffer);
      urls.push(`/uploads/performers/${req.admin!.id}/${filename}`);
    }
    res.json({ urls, url: urls[0] });
  } catch (err) { next(err); }
});

export { router as performerRouter };
