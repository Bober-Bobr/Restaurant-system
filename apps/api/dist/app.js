import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { adminAuthMiddleware, requireRestaurant } from './middleware/auth.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { notFoundMiddleware } from './middleware/notFound.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { eventRouter } from './modules/events/event.routes.js';
import { exportRouter } from './modules/export/export.routes.js';
import { menuRouter } from './modules/menu/menu.routes.js';
import { pricingRouter } from './modules/pricing/pricing.routes.js';
import { publicApiRouter } from './modules/public/public.routes.js';
import { tableCategoryRouter } from './modules/tableCategory/tableCategory.routes.js';
import { hallRouter } from './modules/hall/hall.routes.js';
import { photoRoutes } from './modules/photos/photo.routes.js';
import { restaurantRouter } from './modules/restaurant/restaurant.routes.js';
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
protectedApi.use('/pricing', requireRestaurant, pricingRouter);
protectedApi.use('/exports', requireRestaurant, exportRouter);
protectedApi.use('/table-categories', requireRestaurant, tableCategoryRouter);
protectedApi.use('/halls', requireRestaurant, hallRouter);
protectedApi.use('/photos', photoRoutes);
protectedApi.use('/restaurants', restaurantRouter);
app.use('/api', protectedApi);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
