import { Router } from 'express';
import { VInviteController } from './vinvite.controller.js';
import { inviteAuthMiddleware } from './vinvite.middleware.js';

const router = Router();
const controller = new VInviteController();

// Public (no auth)
router.post('/auth/register', controller.register.bind(controller));
router.post('/auth/login', controller.login.bind(controller));
router.post('/auth/google', controller.google.bind(controller));
router.post('/auth/refresh', controller.refresh.bind(controller));
router.get('/public/:slug', controller.publicBySlug.bind(controller));
router.get('/share/:slug', controller.shareCard.bind(controller));
router.post('/public/:slug/rsvp', controller.publicRsvp.bind(controller));

// Authenticated
router.post('/auth/logout', inviteAuthMiddleware, controller.logout.bind(controller));
router.get('/auth/me', inviteAuthMiddleware, controller.me.bind(controller));
router.patch('/auth/profile', inviteAuthMiddleware, controller.updateProfile.bind(controller));
router.get('/auth/sessions', inviteAuthMiddleware, controller.listSessions.bind(controller));
router.delete('/auth/sessions/:id', inviteAuthMiddleware, controller.revokeSession.bind(controller));

router.get('/slug-check', inviteAuthMiddleware, controller.slugCheck.bind(controller));

router.get('/projects', inviteAuthMiddleware, controller.listProjects.bind(controller));
router.post('/projects', inviteAuthMiddleware, controller.createProject.bind(controller));
router.get('/projects/:id', inviteAuthMiddleware, controller.getProject.bind(controller));
router.patch('/projects/:id', inviteAuthMiddleware, controller.updateProject.bind(controller));
router.delete('/projects/:id', inviteAuthMiddleware, controller.removeProject.bind(controller));
router.get('/projects/:id/rsvps', inviteAuthMiddleware, controller.listRsvps.bind(controller));
router.delete('/projects/:id/rsvps/:rsvpId', inviteAuthMiddleware, controller.removeRsvp.bind(controller));

// Built-in template design overrides: public read, system-admin write.
router.get('/template-overrides', controller.listTemplateOverrides.bind(controller));
router.put('/template-overrides/:templateId', inviteAuthMiddleware, controller.saveTemplateOverride.bind(controller));

// How templates are showcased on the promotional site: public read (the landing
// page is seen logged out), system-admin write.
router.get('/promo-showcase', controller.getPromoShowcase.bind(controller));
router.put('/promo-showcase', inviteAuthMiddleware, controller.savePromoShowcase.bind(controller));

// The studio's own contact block. Any signed-in user may read it (the editor
// shows a preview); only a SYSTEM_ADMIN may change it.
router.get('/platform-contact', inviteAuthMiddleware, controller.getPlatformContact.bind(controller));
router.put('/platform-contact', inviteAuthMiddleware, controller.savePlatformContact.bind(controller));

// Invitation orders placed from a restaurant's Additional Services page. The
// submit side is public (see /api/public/invite-requests); everything here is
// SYSTEM_ADMIN-only, checked inside each controller method.
router.get('/invite-requests', inviteAuthMiddleware, controller.listInviteRequests.bind(controller));
router.get('/invite-requests/unread-count', inviteAuthMiddleware, controller.inviteRequestUnreadCount.bind(controller));
router.patch('/invite-requests/:id/read', inviteAuthMiddleware, controller.setInviteRequestRead.bind(controller));
router.delete('/invite-requests/:id', inviteAuthMiddleware, controller.removeInviteRequest.bind(controller));

router.get('/templates', inviteAuthMiddleware, controller.listTemplates.bind(controller));
router.post('/templates', inviteAuthMiddleware, controller.createTemplate.bind(controller));
router.get('/templates/:id', inviteAuthMiddleware, controller.getTemplate.bind(controller));
router.patch('/templates/:id', inviteAuthMiddleware, controller.updateTemplate.bind(controller));
router.delete('/templates/:id', inviteAuthMiddleware, controller.removeTemplate.bind(controller));

export { router as vinviteRouter };
