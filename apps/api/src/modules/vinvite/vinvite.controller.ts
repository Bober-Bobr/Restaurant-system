import type { Request, Response } from 'express';
import {
  createProjectSchema, createTemplateSchema, googleAuthSchema, loginSchema,
  projectSlug, refreshSchema, registerSchema, rsvpSchema, templateOverrideSchema,
  updateProfileSchema, updateProjectSchema, updateTemplateSchema,
} from './vinvite.schema.js';
import {
  VInviteAuthService, VInviteProjectService, VInviteTemplateService,
  VInviteTemplateOverrideService, type DeviceInfo,
} from './vinvite.service.js';

const authService = new VInviteAuthService();
const projectService = new VInviteProjectService();
const templateService = new VInviteTemplateService();
const overrideService = new VInviteTemplateOverrideService();

function deviceInfo(request: Request): DeviceInfo {
  return {
    userAgent: request.header('user-agent') ?? null,
    ipAddress: request.ip ?? null,
  };
}

export class VInviteController {
  // ── Auth ────────────────────────────────────────────────────────────────────
  async register(request: Request, response: Response) {
    const data = registerSchema.parse(request.body);
    const result = await authService.register(data.email, data.username, data.password, deviceInfo(request));
    response.status(201).json(result);
  }

  async login(request: Request, response: Response) {
    const data = loginSchema.parse(request.body);
    const result = await authService.login(data.identifier, data.password, deviceInfo(request));
    response.json(result);
  }

  async google(request: Request, response: Response) {
    const data = googleAuthSchema.parse(request.body);
    const result = await authService.googleAuth(data.credential, deviceInfo(request));
    response.json(result);
  }

  async refresh(request: Request, response: Response) {
    const data = refreshSchema.parse(request.body);
    const result = await authService.refresh(data.refreshToken);
    response.json(result);
  }

  async logout(request: Request, response: Response) {
    await authService.logout(request.inviteUser?.sid ?? null);
    response.status(204).send();
  }

  async me(request: Request, response: Response) {
    response.json(await authService.me(request.inviteUser!.id));
  }

  async updateProfile(request: Request, response: Response) {
    const data = updateProfileSchema.parse(request.body);
    response.json(await authService.updateProfile(request.inviteUser!.id, data));
  }

  async listSessions(request: Request, response: Response) {
    const user = request.inviteUser!;
    response.json(await authService.listSessions(user.id, user.sid));
  }

  async revokeSession(request: Request, response: Response) {
    await authService.revokeSession(request.inviteUser!.id, String(request.params.id));
    response.status(204).send();
  }

  // ── Projects ────────────────────────────────────────────────────────────────
  async listProjects(request: Request, response: Response) {
    response.json(await projectService.listMine(request.inviteUser!.id));
  }

  async getProject(request: Request, response: Response) {
    response.json(await projectService.getMine(request.inviteUser!.id, String(request.params.id)));
  }

  async createProject(request: Request, response: Response) {
    const data = createProjectSchema.parse(request.body);
    response.status(201).json(await projectService.create(request.inviteUser!.id, data));
  }

  async updateProject(request: Request, response: Response) {
    const data = updateProjectSchema.parse(request.body);
    response.json(await projectService.update(request.inviteUser!.id, String(request.params.id), data));
  }

  async removeProject(request: Request, response: Response) {
    await projectService.remove(request.inviteUser!.id, String(request.params.id));
    response.status(204).send();
  }

  async slugCheck(request: Request, response: Response) {
    const parsed = projectSlug.safeParse(String(request.query.slug ?? ''));
    if (!parsed.success) {
      response.json({ available: false, reason: 'invalid' });
      return;
    }
    const forProjectId = typeof request.query.projectId === 'string' ? request.query.projectId : undefined;
    const available = await projectService.isSlugAvailable(parsed.data, forProjectId);
    response.json({ available });
  }

  // ── Templates ───────────────────────────────────────────────────────────────
  async listTemplates(request: Request, response: Response) {
    response.json(await templateService.listMine(request.inviteUser!.id));
  }

  async getTemplate(request: Request, response: Response) {
    response.json(await templateService.getMine(request.inviteUser!.id, String(request.params.id)));
  }

  async createTemplate(request: Request, response: Response) {
    const data = createTemplateSchema.parse(request.body);
    response.status(201).json(await templateService.create(request.inviteUser!.id, data));
  }

  async updateTemplate(request: Request, response: Response) {
    const data = updateTemplateSchema.parse(request.body);
    response.json(await templateService.update(request.inviteUser!.id, String(request.params.id), data));
  }

  async removeTemplate(request: Request, response: Response) {
    await templateService.remove(request.inviteUser!.id, String(request.params.id));
    response.status(204).send();
  }

  // ── RSVP ────────────────────────────────────────────────────────────────────
  async listRsvps(request: Request, response: Response) {
    response.json(await projectService.listRsvps(request.inviteUser!.id, String(request.params.id)));
  }

  async removeRsvp(request: Request, response: Response) {
    await projectService.removeRsvp(request.inviteUser!.id, String(request.params.id), String(request.params.rsvpId));
    response.status(204).send();
  }

  // ── Public (no auth) ────────────────────────────────────────────────────────
  async publicBySlug(request: Request, response: Response) {
    response.json(await projectService.getPublicBySlug(String(request.params.slug).toLowerCase()));
  }

  /**
   * HTML shell carrying Open Graph tags, used as the link target when an
   * invitation is shared to a chat app. Crawlers read the tags; real browsers
   * run the redirect and land on the invitation itself.
   */
  async shareCard(request: Request, response: Response) {
    // The Host header is attacker-controllable, and it ends up in the OG tags
    // and in the redirect below — so only accept something host-shaped.
    const rawHost = request.header('x-forwarded-host') ?? request.header('host') ?? '';
    const host = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(rawHost) ? rawHost : 'v-invite.uz';
    const proto = (request.header('x-forwarded-proto') ?? request.protocol ?? 'https').split(',')[0].trim();
    const scheme = proto === 'http' ? 'http' : 'https';
    const card = await projectService.getShareCard(String(request.params.slug).toLowerCase(), `${scheme}://${host}`);

    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const description = String(request.query.m ?? '').slice(0, 300);
    response.set('Content-Type', 'text/html; charset=utf-8');
    response.set('Cache-Control', 'public, max-age=300');
    response.send(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${esc(card.title)}</title>
<meta property="og:type" content="website" />
<meta property="og:site_name" content="v-invite.uz" />
<meta property="og:title" content="${esc(card.title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(card.url)}" />
<meta property="og:image" content="${esc(card.image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(card.title)}" />
<meta name="twitter:image" content="${esc(card.image)}" />
<link rel="canonical" href="${esc(card.url)}" />
</head>
<body>
<script>location.replace(${JSON.stringify(card.url)});</script>
<noscript><a href="${esc(card.url)}">${esc(card.title)}</a></noscript>
</body>
</html>`);
  }

  // ── Built-in template overrides (Design+ template editing) ─────────────────
  async listTemplateOverrides(request: Request, response: Response) {
    response.json(await overrideService.list());
  }

  async saveTemplateOverride(request: Request, response: Response) {
    const config = templateOverrideSchema.parse(request.body).config;
    response.json(await overrideService.save(
      request.inviteUser!.id,
      String(request.params.templateId),
      config,
    ));
  }

  async publicRsvp(request: Request, response: Response) {
    const data = rsvpSchema.parse(request.body);
    response.status(201).json(await projectService.submitRsvp(String(request.params.slug).toLowerCase(), data));
  }
}
