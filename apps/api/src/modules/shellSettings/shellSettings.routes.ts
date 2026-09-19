import { Router, type Request, type Response } from 'express';
import { resolveShellSystem } from './shellSettings.rules.js';
import { ShellSettingsService } from './shellSettings.service.js';

const service = new ShellSettingsService();
const router = Router();

/**
 * The shell system of this request, from the caller's role — or a 403 answered
 * here. Mounted behind requireRestaurant, which supplies the restaurant.
 * `system` in the query or body is honoured for platform roles only.
 */
function systemOf(request: Request, response: Response) {
  const requested = request.query.system ?? (request.body as { system?: unknown } | undefined)?.system;
  const system = resolveShellSystem(request.admin?.role, requested);
  if (!system) response.status(403).json({ message: 'Forbidden' });
  return system;
}

router.get('/', async (request, response) => {
  const system = systemOf(request, response);
  if (!system) return;
  response.json({ system, settings: await service.get(request.restaurantId!, system) });
});

router.put('/', async (request, response) => {
  const system = systemOf(request, response);
  if (!system) return;
  // `system` is routing, not a setting — strip it before the strict schema sees it.
  const { system: _ignored, ...body } = (request.body ?? {}) as Record<string, unknown>;
  response.json({ system, settings: await service.save(request.restaurantId!, system, body) });
});

export { router as shellSettingsRouter };
