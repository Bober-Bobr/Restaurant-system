import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { AdminRole } from '@prisma/client';
import { adminAuthMiddleware, requireRestaurant, requireRole } from './middleware/auth.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventRouter } from './modules/events/event.routes.js';
import { exportRouter } from './modules/export/export.routes.js';
import { menuRouter } from './modules/menu/menu.routes.js';
import { subcategoryRouter } from './modules/subcategory/subcategory.routes.js';
import { pricingRouter } from './modules/pricing/pricing.routes.js';
import { publicApiRouter } from './modules/public/public.routes.js';
import { tableCategoryRouter } from './modules/tableCategory/tableCategory.routes.js';
import { hallRouter } from './modules/hall/hall.routes.js';
import { photoRoutes } from './modules/photos/photo.routes.js';
import { restaurantRouter } from './modules/restaurant/restaurant.routes.js';
import { companyRouter } from './modules/company/company.routes.js';
import { invitationRouter } from './modules/invitation/invitation.routes.js';
import { guestInvitationRouter } from './modules/guestInvitation/guestInvitation.routes.js';
import { designTemplateRouter } from './modules/designTemplate/designTemplate.routes.js';
import { vinviteRouter } from './modules/vinvite/vinvite.routes.js';
import { adminOrInviteAuthMiddleware } from './modules/vinvite/vinvite.middleware.js';
import { reviewRouter } from './modules/review/review.routes.js';
import { expenseRouter } from './modules/expense/expense.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key'],
}));
app.use(express.json({ limit: '1mb' }));

// Serve uploaded photos statically with absolute path.
// Override Helmet's default Cross-Origin-Resource-Policy: same-origin so the
// frontend (different port) can load images via <img> tags.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '..', 'uploads');

app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(uploadsDir, {
  maxAge: '1y',
  etag: false
}));

app.get('/', (_request, response) => {
  response.json({ name: 'Banquet API', status: 'ok' });
});

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/public', publicApiRouter);

const protectedApi = express.Router();
protectedApi.use(adminAuthMiddleware);
protectedApi.use('/events', requireRestaurant, eventRouter);
protectedApi.use('/menu-items', requireRestaurant, menuRouter);
protectedApi.use('/subcategories', requireRestaurant, subcategoryRouter);
protectedApi.use('/pricing', requireRestaurant, pricingRouter);
protectedApi.use('/exports', requireRestaurant, exportRouter);
protectedApi.use('/table-categories', requireRestaurant, tableCategoryRouter);
protectedApi.use('/halls', requireRestaurant, hallRouter);
protectedApi.use('/restaurants', restaurantRouter);
// Restaurant Manager expense ledger — scoped to the calling manager, not a restaurant.
protectedApi.use('/expenses', requireRole(AdminRole.RESTAURANT_MANAGER, AdminRole.CHIEF_ADMIN), expenseRouter);
protectedApi.use('/companies', companyRouter);
// Invitations: auth middleware is applied inside the router (it's outside the auto-mounted protected API
// because routes use roles directly without requireRestaurant).
app.use('/api/invitations', invitationRouter);
app.use('/api/guest-invitations', guestInvitationRouter);
app.use('/api/design-templates', designTemplateRouter);
// v-invite.uz — standalone invitation-builder product (own users/auth, mixed
// public + authenticated routes handled inside the router).
app.use('/api/vinvite', vinviteRouter);
// Photo/audio uploads are shared infrastructure: both v-menu admins and
// v-invite users may upload (the controller tolerates a missing admin context).
app.use('/api/photos', adminOrInviteAuthMiddleware, photoRoutes);
app.use('/api/reviews', reviewRouter);

app.use('/api', protectedApi);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
