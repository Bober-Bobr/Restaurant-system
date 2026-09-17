import { describe, expect, it } from 'vitest';
import { eventsPath } from './eventsPath';
import type { AdminRole } from '../store/auth.store';

describe('where a role\'s events list lives', () => {
  it('is /events for the supervisor, whose / is the floor map', () => {
    expect(eventsPath('SUPERVISOR')).toBe('/events');
  });

  it('and / for everybody else — including the section\'s own kitchen, which has no map', () => {
    for (const role of ['ADMIN', 'EMPLOYEE', 'KITCHEN', 'SMALL_KITCHEN', 'CHIEF_ADMIN', 'OWNER'] as AdminRole[]) {
      expect(eventsPath(role), role).toBe('/');
    }
    expect(eventsPath(null)).toBe('/');
  });
});
