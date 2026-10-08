import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bookingsForArea, buildFloorPlanPdf, fillOf, heldTables, stringsFor, timeOf } from './floorMap.pdf.service.js';
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

describe('a reserved table says whether it is FULL', () => {
  // A party of three at a ten-top leaves seven seats the restaurant can still
  // sell; a sheet that draws that exactly like a full table hides it.
  const held = (seated: number) => heldTables(
    [booking({ id: 'e1', floorTables: [{ floorTableId: 't1', guestCount: seated }] })], 'street',
  );

  it('part-filled, full and free are three different states', () => {
    const six = { id: 't1', seats: 6 };
    const part = held(3);
    expect(fillOf(six, part.held, part.guests, part.whole)).toBe('partly');
    const all = held(6);
    expect(fillOf(six, all.held, all.guests, all.whole)).toBe('taken');
    expect(fillOf({ id: 't2', seats: 6 }, all.held, all.guests, all.whole)).toBe('free');
  });

  it('a whole-area booking is full — it has no per-table count', () => {
    const { held: h, guests, whole } = heldTables([booking({ id: 'w', wholeHall: true })], 'street');
    expect(whole).not.toBeNull();
    expect(fillOf({ id: 't1', seats: 6 }, h, guests, whole)).toBe('taken');
  });

  it('and the three fills survive a mono photocopy, which is what fixes them', () => {
    // The fills are red / yellow / open now rather than three greys, and the
    // photocopy argument is the thing that still decides WHICH red and yellow.
    // A scanner sees BT.601 luma: these have to stay plainly different greys,
    // in the order taken ‹ partly ‹ free. Three distinct hex strings is not
    // enough — two colours can differ and photocopy to the same shade, which
    // is the failure nobody notices until somebody is holding the copy.
    const src = readFileSync(new URL('./floorMap.pdf.service.ts', import.meta.url), 'utf8');
    const named = Object.fromEntries(
      [...src.matchAll(/^const (TAKEN_FILL|PARTLY_FILL|FREE_FILL) = '(#[0-9a-f]{6})';/gm)]
        .map((m) => [m[1], m[2]]),
    ) as Record<string, string>;
    expect(Object.keys(named).sort()).toEqual(['FREE_FILL', 'PARTLY_FILL', 'TAKEN_FILL']);

    const luma = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const taken = luma(named.TAKEN_FILL);
    const partly = luma(named.PARTLY_FILL);
    const free = luma(named.FREE_FILL);

    expect(taken, 'taken must photocopy darkest').toBeLessThan(partly);
    expect(partly, 'part-filled must photocopy lighter than taken').toBeLessThan(free);
    // Far enough apart to read as different shades on a poor copier.
    expect(partly - taken, 'taken vs part-filled').toBeGreaterThan(60);
    expect(free - partly, 'part-filled vs free').toBeGreaterThan(30);
  });

  it('prints a label the table\'s own fill can carry', () => {
    // White goes on the red and ink on the yellow, so each number is readable
    // against the thing it is written on. WCAG 4.5:1 both ways.
    const src = readFileSync(new URL('./floorMap.pdf.service.ts', import.meta.url), 'utf8');
    const fill = (name: string) =>
      new RegExp(`^const ${name} = '(#[0-9a-f]{6})';`, 'm').exec(src)![1];

    const channel = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : (((c / 255) + 0.055) / 1.055) ** 2.4);
    const relLum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    expect(contrast('#ffffff', fill('TAKEN_FILL')), 'white number on the red')
      .toBeGreaterThanOrEqual(4.5);
    expect(contrast('#111827', fill('PARTLY_FILL')), 'ink number on the yellow')
      .toBeGreaterThanOrEqual(4.5);
    // And the sheet actually draws them that way round.
    expect(src).toMatch(/fillColor\(state === 'taken' \? '#ffffff' : INK\)/);
  });
});

describe('the sheet is translated whole, and its clock is the reader\'s', () => {
  it('every language declares every string — a half-translated sheet cannot be switched on paper', () => {
    const en = stringsFor('en');
    for (const lang of ['ru', 'uz']) {
      const s = stringsFor(lang);
      expect(Object.keys(s).sort(), lang).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(s)) {
        expect(value, `${lang}.${key} is empty`).toBeTruthy();
        expect(value, `${lang}.${key} was never translated`).not.toBe((en as Record<string, string>)[key]);
      }
    }
  });

  it('an unknown or missing language reads in English rather than blank', () => {
    expect(stringsFor(undefined)).toEqual(stringsFor('en'));
    expect(stringsFor('de')).toEqual(stringsFor('en'));
    // Case is not a language.
    expect(stringsFor('RU')).toEqual(stringsFor('ru'));
  });

  it('the uz strings carry no apostrophes, like every other uz string here', () => {
    for (const value of Object.values(stringsFor('uz'))) expect(value).not.toMatch(/['’]/);
  });

  it('a 19:00 booking prints as 19:00 in the restaurant\'s own timezone', () => {
    // Stored as an instant: five hours earlier in UTC. Printed as UTC it read
    // 14:00 — the middle of lunch — which is what item 4 was.
    expect(timeOf('2026-10-02T14:00:00.000Z', 300)).toBe('19:00');
    // No offset given is UTC, unchanged behaviour for any caller that sends none.
    expect(timeOf('2026-10-02T14:00:00.000Z')).toBe('14:00');
    // Over midnight, and unparseable input.
    expect(timeOf('2026-10-02T22:30:00.000Z', 300)).toBe('03:30');
    expect(timeOf('nonsense', 300)).toBe('');
  });

  it('the Cyrillic font is registered, with a fallback that still produces a sheet', () => {
    const src = readFileSync(new URL('./floorMap.pdf.service.ts', import.meta.url), 'utf8');
    // Helvetica is WinAnsi-encoded: every Russian letter came out as a random
    // glyph. The other exports here register the same font the same way.
    expect(src).toContain("doc.registerFont('R', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')");
    expect(src).toContain("doc.registerFont('B', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')");
    expect(src).toContain('catch { /* keep Helvetica */ }');
    // And nothing draws with the built-in font any more, or that line reverts
    // to mojibake on its own.
    const body = src.slice(src.indexOf('export function buildFloorPlanPdf'));
    expect(body.match(/\.font\('Helvetica(-Bold)?'\)/g), 'a draw call still names Helvetica').toBeNull();
  });
});

describe('what reaches the sheet from the request and the database', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('the controller forwards the language and the timezone it was sent', () => {
    // Parsed but dropped, the sheet silently reverts to English UTC — which
    // looks exactly like the bug it fixes.
    const controller = read('./floorMap.controller.ts');
    expect(controller).toContain('printSchema.parse(request.query)');
    expect(controller).toContain('buildFloorPlanPdf({ ...plan, lang, tzOffsetMinutes: tz })');
  });

  it('and the day is read with the bookings that merely NAME an area', () => {
    // Source-reading, like `sectionScoping.test.ts`: there is no database in
    // this suite and what matters is the shape of the query. Without the third
    // arm, a booking made on the Events page is nowhere on the map or the
    // sheet, which is what item 1 was.
    const repo = read('./floorMap.repository.ts');
    const both = [...repo.matchAll(/OR: \[[^\]]*\]/g)].map((m) => m[0]);
    expect(both.length, 'the day and schedule queries').toBe(2);
    for (const clause of both) {
      expect(clause).toContain('{ wholeHall: true }');
      expect(clause).toContain('{ floorTables: { some: {} } }');
      expect(clause, 'a booking that only names an area is filtered out again').toContain('{ hallId: { not: null } }');
    }
  });

  it('as is the clash check that refuses a whole-area booking over one', () => {
    const floor = read('../events/event.floorTables.ts');
    const clause = floor.match(/OR: \[[^\]]*\]/)?.[0] ?? '';
    expect(clause).toContain('{ hallId: { not: null } }');
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

  it('builds a Russian sheet with Cyrillic names throughout', async () => {
    // What garbled: the area's name, the zone labels and the customers'.
    const doc = buildFloorPlanPdf({
      area: area({
        name: 'Новый зал',
        mapFeatures: [{ kind: 'zone', shape: 'rect', x: 40, y: 40, width: 300, height: 200, label: 'Терраса' }],
      }),
      tables: TABLES,
      bookings: [booking({ id: 'e1', customerName: 'Каримов', floorTables: [{ floorTableId: 't1', guestCount: 4 }] })],
      day: '2026-10-02',
      restaurantName: 'Сангизар',
      lang: 'ru',
      tzOffsetMinutes: 300,
    });
    expect((await render(doc)).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('builds one listing a booking that names the area and holds no table', async () => {
    // The Events page makes these; they used to be nowhere on the sheet.
    const doc = buildFloorPlanPdf({
      area: area(),
      tables: TABLES,
      bookings: [booking({ id: 'pending', eventNumber: 12, guestCount: 40, customerPhone: '+998901112233' })],
      day: '2026-10-02',
      lang: 'uz',
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
