import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isEventNumberCollision } from './event.repository.js';

/**
 * Event numbers restart at 1 for every restaurant — `EventRepository.create`
 * derives the next one from that restaurant's own maximum, and the whole API
 * addresses an event by (restaurantId, eventNumber).
 *
 * The column nevertheless carried a GLOBAL unique constraint. The two rules
 * contradict each other, and the failure was permanent rather than
 * intermittent: once another restaurant owned the number a restaurant's
 * counter had reached, every create it attempted recomputed that same number
 * and was refused. Staff saw only "Failed to create event. Please try again",
 * and trying again could never work.
 *
 * The constraint lives in the schema, so the schema is where it is asserted.
 */
const SCHEMA = readFileSync(
  fileURLToPath(new URL('../../../prisma/schema.prisma', import.meta.url)),
  'utf8',
);

function modelBody(name: string): string {
  const match = SCHEMA.match(new RegExp(`\\nmodel ${name} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[1];
}

describe('an event number is unique within its restaurant, not globally', () => {
  const event = modelBody('Event');

  it('does not declare eventNumber globally unique', () => {
    const field = event.split('\n').find((l) => /^\s*eventNumber\s/.test(l)) ?? '';
    expect(field, 'eventNumber field not found').toMatch(/eventNumber/);
    expect(field, 'a global @unique makes two restaurants fight over one number').not.toContain('@unique');
  });

  it('scopes the uniqueness to the restaurant', () => {
    expect(event).toMatch(/@@unique\(\[\s*restaurantId\s*,\s*eventNumber\s*\]\)/);
  });

  it('ships a migration that replaces the global index with the scoped one', () => {
    // The schema alone changes nothing on a running database.
    const dir = fileURLToPath(new URL('../../../prisma/migrations', import.meta.url));
    const sql = readdirSync(dir)
      .filter((d) => !d.endsWith('.toml'))
      .map((d) => {
        try {
          return readFileSync(`${dir}/${d}/migration.sql`, 'utf8');
        } catch {
          return '';
        }
      })
      .join('\n');
    expect(sql).toContain('DROP INDEX IF EXISTS "Event_eventNumber_key"');
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*"Event_restaurantId_eventNumber_key"/);
  });
});

describe('recognising a lost race for an event number', () => {
  it('accepts the unique violation the scoped index raises', () => {
    expect(
      isEventNumberCollision({ code: 'P2002', meta: { target: ['restaurantId', 'eventNumber'] } }),
    ).toBe(true);
  });

  it('accepts the string form some drivers report', () => {
    expect(isEventNumberCollision({ code: 'P2002', meta: { target: 'Event_restaurantId_eventNumber_key' } })).toBe(true);
  });

  it('refuses every other unique violation', () => {
    // Retrying an unrelated collision — a duplicate slug, say — would spin five
    // times and then report the same error later, hiding the real cause.
    expect(isEventNumberCollision({ code: 'P2002', meta: { target: ['slug'] } })).toBe(false);
  });

  it('refuses errors that are not unique violations at all', () => {
    expect(isEventNumberCollision({ code: 'P2003', meta: { target: ['eventNumber'] } })).toBe(false);
    expect(isEventNumberCollision(new Error('connection lost'))).toBe(false);
    expect(isEventNumberCollision(null)).toBe(false);
    expect(isEventNumberCollision({ code: 'P2002' })).toBe(false);
  });
});
