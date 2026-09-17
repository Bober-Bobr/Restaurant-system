import type { AdminRole } from '../store/auth.store';

/**
 * Where a role's events list lives.
 *
 * Every app has it at `/`, except Small Banquets: there `/` is the floor map,
 * the section's main page, and the events moved to `/events`. Shared pages that
 * deep-link into an event (the calendar's "edit" button) ask here rather than
 * writing `/`, which on the supervisor host would open the map and drop the
 * event they were asked to show.
 */
export function eventsPath(role: AdminRole | null | undefined): string {
  return role === 'SUPERVISOR' ? '/events' : '/';
}
