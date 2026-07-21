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

router.get('/templates', inviteAuthMiddleware, controller.listTemplates.bind(controller));
router.post('/templates', inviteAuthMiddleware, controller.createTemplate.bind(controller));
router.get('/templates/:id', inviteAuthMiddleware, controller.getTemplate.bind(controller));
router.patch('/templates/:id', inviteAuthMiddleware, controller.updateTemplate.bind(controller));
router.delete('/templates/:id', inviteAuthMiddleware, controller.removeTemplate.bind(controller));

export { router as vinviteRouter };
