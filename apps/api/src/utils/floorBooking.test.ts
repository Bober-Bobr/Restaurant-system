import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bookingClash, dayKey, dayRange, guestCountOf, holdsTables, occupancyOf,
  takenTableIds, wholeAreaAvailable, type BookingRow,
} from './floorBooking.js';

/**
 * Who holds which table, on which day.
 *
 * The map draws from this and the booking path refuses from it, so every rule
 * about double-booking lives here and is tested without a database.
 */
const booking = (over: Partial<BookingRow> & { id: string }): BookingRow => ({
  eventNumber: 1, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z',
  status: 'CONFIRMED', guestCount: 8, hallId: 'street', wholeHall: false, floorTables: [],
  ...over,
});

const seat = (floorTableId: string, guestCount = 4) => ({ floorTableId, guestCount });

/** Street has tables 1–3; the Terrace has one. */
const TABLES = new Map<string, string[]>([['street', ['t1', 't2', 't3']], ['terrace', ['x1']]]);

describe('a booking holds its tables for the whole day', () => {
  it('the day is read in UTC, so the answer does not move with the server', () => {
    expect(dayKey('2026-10-02T19:00:00.000Z')).toBe('2026-10-02');
    expect(dayKey('2026-10-02T23:30:00.000Z')).toBe('2026-10-02');
    expect(dayKey(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
  });

  it('an unreadable date is empty rather than "now"', () => {
    // Defaulting to today would silently book a table on the wrong day.
    expect(dayKey('not a date')).toBe('');
  });

  it('the day\'s range is midnight to midnight UTC', () => {
    const { gte, lt } = dayRange('2026-10-02');
    expect(gte.toISOString()).toBe('2026-10-02T00:00:00.000Z');
    expect(lt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
    expect(lt.getTime() - gte.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('which bookings still hold their tables', () => {
  it('a cancelled booking holds nothing — that is what cancelling is for', () => {
    expect(holdsTables('CANCELLED')).toBe(false);
    const occupancy = occupancyOf([booking({ id: 'e1', status: 'CANCELLED', floorTables: [seat('t1')] })]);
    expect(occupancy.tables.size).toBe(0);
  });

  it('a DRAFT booking DOES — a table being pencilled in is what the next person needs to see', () => {
    expect(holdsTables('DRAFT')).toBe(true);
    for (const status of ['DRAFT', 'CONFIRMED', 'COMPLETED', 'MENU_NOT_SELECTED']) {
      expect(holdsTables(status), status).toBe(true);
    }
  });
});

describe('what is taken', () => {
  it('names the booking holding each table', () => {
    const e1 = booking({ id: 'e1', floorTables: [seat('t1'), seat('t2')] });
    const occupancy = occupancyOf([e1]);
    expect(occupancy.tables.get('t1')).toBe(e1);
    expect(occupancy.tables.get('t3')).toBeUndefined();
  });

  it('a whole-area booking takes every table in that area', () => {
    const whole = booking({ id: 'e2', wholeHall: true, hallId: 'street' });
    const taken = takenTableIds(occupancyOf([whole]), TABLES);
    expect([...taken].sort()).toEqual(['t1', 't2', 't3']);
    // …and nothing in the area next door.
    expect(taken.has('x1')).toBe(false);
  });
});

describe('reserving a whole area', () => {
  it('is possible only once every table in it is free', () => {
    expect(wholeAreaAvailable('street', occupancyOf([]), TABLES)).toBe(true);
    const one = occupancyOf([booking({ id: 'e1', floorTables: [seat('t2')] })]);
    expect(wholeAreaAvailable('street', one, TABLES)).toBe(false);
    // The other area is unaffected by Street's single held table.
    expect(wholeAreaAvailable('terrace', one, TABLES)).toBe(true);
  });

  it('an area with no tables drawn cannot be let — "all of nothing" is not a venue', () => {
    expect(wholeAreaAvailable('empty', occupancyOf([]), TABLES)).toBe(false);
  });

  it('a booking editing itself does not block itself', () => {
    const mine = occupancyOf([booking({ id: 'mine', floorTables: [seat('t1')] })]);
    expect(wholeAreaAvailable('street', mine, TABLES)).toBe(false);
    expect(wholeAreaAvailable('street', mine, TABLES, 'mine')).toBe(true);
  });

  it('a cancelled whole-area booking releases the venue', () => {
    const gone = occupancyOf([booking({ id: 'e1', wholeHall: true, status: 'CANCELLED' })]);
    expect(wholeAreaAvailable('street', gone, TABLES)).toBe(true);
  });
});

describe('what clashes with what', () => {
  const held = occupancyOf([booking({ id: 'held', eventNumber: 7, floorTables: [seat('t2')] })]);

  it('a free table is taken without complaint', () => {
    expect(bookingClash({ hallId: 'street', wholeHall: false, selections: [seat('t1')] }, held, TABLES)).toBeNull();
  });

  it('a table somebody else holds is refused, and the refusal names them', () => {
    const clash = bookingClash({ hallId: 'street', wholeHall: false, selections: [seat('t2')] }, held, TABLES);
    expect(clash).toMatchObject({ kind: 'table', floorTableId: 't2' });
    // Named so the message can say WHO — "unavailable" alone sends a
    // receptionist away from the desk to find out.
    expect(clash?.booking.eventNumber).toBe(7);
  });

  it('a booking may keep the tables it already holds', () => {
    expect(bookingClash({ hallId: 'street', wholeHall: false, selections: [seat('t2')] }, held, TABLES, 'held')).toBeNull();
  });

  it('a whole-area request is refused by ONE held table in it', () => {
    const clash = bookingClash({ hallId: 'street', wholeHall: true, selections: [] }, held, TABLES);
    expect(clash).toMatchObject({ kind: 'table', floorTableId: 't2' });
  });

  it('and a table inside an area somebody took whole is itself taken', () => {
    const whole = occupancyOf([booking({ id: 'w', eventNumber: 9, wholeHall: true, hallId: 'street' })]);
    const clash = bookingClash({ hallId: 'street', wholeHall: false, selections: [seat('t3')] }, whole, TABLES);
    expect(clash).toMatchObject({ kind: 'area', hallId: 'street' });
    expect(clash?.booking.eventNumber).toBe(9);
  });

  it('two whole-area bookings on one day collide', () => {
    const whole = occupancyOf([booking({ id: 'w', wholeHall: true, hallId: 'street' })]);
    expect(bookingClash({ hallId: 'street', wholeHall: true, selections: [] }, whole, TABLES)).toMatchObject({ kind: 'area' });
    // The other area is still free to be taken whole.
    expect(bookingClash({ hallId: 'terrace', wholeHall: true, selections: [] }, whole, TABLES)).toBeNull();
  });
});

describe('the head count is the sum of the tables', () => {
  it('adds the tables up rather than trusting a reported total', () => {
    expect(guestCountOf([seat('t1', 6), seat('t2', 4)], 999)).toBe(10);
  });

  it('falls back to the typed figure when no table is named', () => {
    // A booking with no tables — the Events page still creates blank events.
    expect(guestCountOf([], 25)).toBe(25);
  });

  it('a negative count cannot subtract from the party', () => {
    expect(guestCountOf([seat('t1', 6), seat('t2', -5)], 0)).toBe(6);
  });
});

describe('the wiring', () => {
  const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
  const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('the head count stored is the derived one, never the client\'s', () => {
    const service = read('src/modules/events/event.service.ts');
    expect(service).toContain('guestCount: floor.guestCount');
  });

  it('tables are checked BEFORE the booking row is written', () => {
    // A booking created and then refused its tables leaves a party with no
    // seats and a number staff have already read out.
    const service = read('src/modules/events/event.service.ts');
    expect(service.indexOf('resolveFloorTables')).toBeLessThan(service.indexOf('this.eventRepository.create'));
  });

  it('an update that does not mention the tables leaves them alone', () => {
    // An admin editing a phone number must not release a party's tables.
    const service = read('src/modules/events/event.service.ts');
    expect(service).toContain('payload.floorTables !== undefined || payload.wholeHall !== undefined');
  });

  it('every selected table is re-checked against the caller\'s own scope', () => {
    // Scoped to the query that looks the CHOSEN ids up. The file has other
    // reads carrying the same clause, so asserting it anywhere in the file
    // passes against the one place it matters having lost it.
    const floor = read('src/modules/events/event.floorTables.ts');
    const at = floor.indexOf('const tables = await prisma.floorTable.findMany(');
    expect(at, 'the id lookup is gone — this test needs rewriting').toBeGreaterThan(-1);
    const lookup = floor.slice(at, floor.indexOf('});', at));
    expect(lookup).toContain('id: { in: ids }');
    expect(lookup).toMatch(/hall:\s*\{\s*restaurantId,\s*section\s*\}/);
  });

  it('the migration adds both columns without touching existing bookings', () => {
    const sql = fs.readFileSync(path.join(API_ROOT, 'prisma/migrations/20260923100000_floor_bookings/migration.sql'), 'utf8');
    expect(sql).toContain('ADD COLUMN "wholeHall" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('CREATE TABLE "EventFloorTable"');
    // Both sides cascade: a deleted booking releases its tables, and a table
    // removed from the map takes its holds with it.
    expect((sql.match(/ON DELETE CASCADE/g) ?? []).length).toBe(2);
    expect(sql).toContain('CREATE UNIQUE INDEX "EventFloorTable_eventId_floorTableId_key"');
  });
});
