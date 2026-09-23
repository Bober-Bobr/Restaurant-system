import { describe, expect, it } from 'vitest';
import { bookingsForArea, buildFloorPlanPdf, heldTables } from './floorMap.pdf.service.js';
import type { BookingRow } from '../../utils/floorBooking.js';
import type { AreaRow, TableRow } from './floorMap.repository.js';

/**
 * The printable plan of an area for a day.
 *
 * The layout is PDFKit drawing calls, which are not worth asserting — so what
 * is covered here is the ARRANGEMENT the sheet is drawn from (who holds what,
 * which bookings belong on this sheet at all), in the style of
 * `pdfTables.test.ts`, plus that the document actually builds.
 */
const area = (over: Partial<AreaRow> = {}): AreaRow => ({
  id: 'street', name: 'Street', kind: 'OUTDOOR', capacity: 120, isActive: true,
  restaurantId: 'r1', section: 'SMALL_BANQUET',
  mapWidth: 1600, mapHeight: 1000, mapFeatures: [], defaultLayoutAt: null, ...over,
});

const table = (id: string, label: string, over: Partial<TableRow> = {}): TableRow => ({
  id, hallId: 'street', label, seats: 6, shape: 'RECT', x: 200, y: 200, rotation: 0,
  width: null, height: null, ...over,
});

const booking = (over: Partial<BookingRow> & { id: string }): BookingRow => ({
  eventNumber: 1, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z',
  status: 'CONFIRMED', guestCount: 6, hallId: 'street', wholeHall: false, floorTables: [], ...over,
});

const TABLES = [table('t1', '1'), table('t2', '2', { x: 500 }), table('t3', '3', { x: 800, shape: 'ROUND' })];

describe('who holds what on the sheet', () => {
  it('names the booking against each held table, with the guests seated there', () => {
    const { held, guests } = heldTables([
      booking({ id: 'e1', eventNumber: 4, floorTables: [{ floorTableId: 't2', guestCount: 5 }] }),
    ], 'street');
    expect(held.get('t2')?.eventNumber).toBe(4);
    expect(guests.get('t2')).toBe(5);
    expect(held.has('t1')).toBe(false);
  });

  it('a cancelled booking holds nothing — the table prints as free', () => {
    const { held, whole } = heldTables([
      booking({ id: 'e1', status: 'CANCELLED', floorTables: [{ floorTableId: 't1', guestCount: 4 }] }),
      booking({ id: 'e2', status: 'CANCELLED', wholeHall: true }),
    ], 'street');
    expect(held.size).toBe(0);
    expect(whole).toBeNull();
  });

  it('a whole-area booking is reported for THIS area only', () => {
    expect(heldTables([booking({ id: 'w', wholeHall: true, hallId: 'street' })], 'street').whole?.id).toBe('w');
    expect(heldTables([booking({ id: 'w', wholeHall: true, hallId: 'terrace' })], 'street').whole).toBeNull();
  });
});

describe('which bookings belong on this sheet', () => {
  it('the ones holding a table on this map', () => {
    const mine = booking({ id: 'mine', floorTables: [{ floorTableId: 't1', guestCount: 4 }] });
    const nextDoor = booking({ id: 'next', hallId: 'terrace', floorTables: [{ floorTableId: 'x9', guestCount: 4 }] });
    expect(bookingsForArea([mine, nextDoor], 'street', TABLES).map((b) => b.id)).toEqual(['mine']);
  });

  it('and one taking this area whole', () => {
    const whole = booking({ id: 'w', wholeHall: true, hallId: 'street' });
    expect(bookingsForArea([whole], 'street', TABLES).map((b) => b.id)).toEqual(['w']);
    // …but not one taking the room next door whole.
    expect(bookingsForArea([booking({ id: 'w2', wholeHall: true, hallId: 'terrace' })], 'street', TABLES)).toEqual([]);
  });

  it('never a cancelled one', () => {
    const gone = booking({ id: 'gone', status: 'CANCELLED', floorTables: [{ floorTableId: 't1', guestCount: 4 }] });
    expect(bookingsForArea([gone], 'street', TABLES)).toEqual([]);
  });
});

describe('the document itself', () => {
  const render = (doc: PDFKit.PDFDocument): Promise<Buffer> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

  it('builds a PDF for a day with bookings', async () => {
    const doc = buildFloorPlanPdf({
      area: area({
        mapFeatures: [
          { kind: 'water', shape: 'ellipse', x: 600, y: 600, width: 300, height: 200 },
          { kind: 'zone', shape: 'rect', x: 40, y: 40, width: 300, height: 200, label: 'Terrace' },
          { kind: 'path', shape: 'polygon', points: [[0, 0], [100, 0], [100, 100]] },
          { kind: 'label', shape: 'point', x: 800, y: 100, label: 'Stage' },
        ],
      }),
      tables: TABLES,
      bookings: [booking({ id: 'e1', floorTables: [{ floorTableId: 't1', guestCount: 4 }] })],
      day: '2026-10-02',
      restaurantName: 'Sangizar',
    });
    const buffer = await render(doc);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('builds one for an empty day, and for an area that has never been sized', async () => {
    // A sheet printed for a quiet Tuesday is still a sheet.
    const doc = buildFloorPlanPdf({
      area: area({ mapWidth: null, mapHeight: null }),
      tables: TABLES,
      bookings: [],
      day: '2026-10-03',
    });
    expect((await render(doc)).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('builds one for a venue-sized plan with many bookings, spilling onto a second page', async () => {
    const many = Array.from({ length: 40 }, (_, i) => table(`m${i}`, String(i + 1), { x: 100 + (i % 10) * 140, y: 120 + Math.floor(i / 10) * 200 }));
    const doc = buildFloorPlanPdf({
      area: area(),
      tables: many,
      bookings: many.map((tb, i) => booking({
        id: `b${i}`, eventNumber: i + 1, customerName: `Guest ${i + 1}`,
        floorTables: [{ floorTableId: tb.id, guestCount: 4 }],
      })),
      day: '2026-10-02',
    });
    expect((await render(doc)).length).toBeGreaterThan(2000);
  });
});
