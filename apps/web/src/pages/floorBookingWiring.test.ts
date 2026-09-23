import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { areaHolder, tableHolders, tablesByHallOf, wholeAreaAvailable, type MapOccupancy } from '../utils/floorBooking';

/**
 * Booking tables on the map, from the screens' side.
 *
 * The rules are held by `floorBooking.test.ts` (API) and the agreement test;
 * what is checked here is the chain around them — that the kiosk and the admin
 * map read the SAME occupancy, that a taken table cannot be picked, and that
 * what the guest chose is what the booking is sent with.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const kiosk = src('pages/KioskFloorSection.tsx');
const admin = src('pages/FloorMapPage.tsx');
const summary = src('pages/TabletSummaryPage.tsx');
const plan = src('components/floor/FloorPlanView.tsx');

const TABLES = [
  { id: 't1', hallId: 'street' }, { id: 't2', hallId: 'street' }, { id: 't3', hallId: 'street' },
  { id: 'x1', hallId: 'terrace' },
];
const byHall = tablesByHallOf(TABLES);

const day = (bookings: MapOccupancy['bookings']): MapOccupancy => ({ day: '2026-10-02', bookings });
const b = (over: Partial<MapOccupancy['bookings'][number]> & { id: string }) => ({
  eventNumber: 1, customerName: 'Nodira', eventDate: '2026-10-02T19:00:00.000Z', status: 'CONFIRMED',
  guestCount: 4, hallId: 'street', wholeHall: false, floorTables: [], ...over,
});

describe('who holds what, as the screens read it', () => {
  it('a booking holds the tables it names', () => {
    const holders = tableHolders(day([b({ id: 'e1', floorTables: [{ floorTableId: 't2', guestCount: 4 }] })]), byHall);
    expect(holders.get('t2')?.id).toBe('e1');
    expect(holders.has('t1')).toBe(false);
  });

  it('a whole-area booking holds every table in that area, and none next door', () => {
    const holders = tableHolders(day([b({ id: 'w', wholeHall: true })]), byHall);
    expect([...holders.keys()].sort()).toEqual(['t1', 't2', 't3']);
    expect(holders.has('x1')).toBe(false);
    expect(areaHolder(day([b({ id: 'w', wholeHall: true })]), 'street')?.id).toBe('w');
  });

  it('a cancelled booking holds nothing', () => {
    const holders = tableHolders(day([b({ id: 'e1', status: 'CANCELLED', floorTables: [{ floorTableId: 't2', guestCount: 4 }] })]), byHall);
    expect(holders.size).toBe(0);
  });

  it('the whole area is offered only while every table in it is free', () => {
    expect(wholeAreaAvailable('street', day([]), byHall)).toBe(true);
    expect(wholeAreaAvailable('street', day([b({ id: 'e1', floorTables: [{ floorTableId: 't1', guestCount: 2 }] })]), byHall)).toBe(false);
    // An area with nothing drawn on it cannot be let.
    expect(wholeAreaAvailable('nowhere', day([]), byHall)).toBe(false);
  });
});

describe('the kiosk map', () => {
  it('reads occupancy for the BOOKING\'s day, not for today', () => {
    // Moving the date has to change what is free, or the guest picks a table
    // the server then refuses.
    expect(kiosk).toContain("queryKey: ['kiosk-floor-day', day]");
    expect(kiosk).toContain('const day = date || dayKey(new Date());');
  });

  it('a taken table is drawn as taken and cannot be picked', () => {
    expect(kiosk).toContain("return holders.has(table.id) ? 'taken' : 'free';");
    // The refusal is in the shared plan: `is-taken` is not pickable.
    expect(plan).toContain("const pickable = !!onTableClick && state !== 'taken';");
    expect(plan).toContain('.fp-table.is-taken { cursor: not-allowed; }');
  });

  it('is mounted in BOTH sessions — the menu page and, for dining, the summary', () => {
    expect(src('pages/TabletMenuPage.tsx')).toContain('<KioskFloorSection date={eventDate}');
    expect(summary).toContain('{!surface.menu && <KioskFloorSection date={eventDate}');
  });

  it('the dining map is drawn LARGE — that session is only the map', () => {
    // There is no menu, package or price beside it, so the plan is the page
    // rather than a card on it.
    expect(summary).toMatch(/<KioskFloorSection date=\{eventDate\} large /);
    // …and the banquet session's, which shares the page with the menu, is not.
    expect(src('pages/TabletMenuPage.tsx')).not.toMatch(/<KioskFloorSection[^>]*\blarge\b/);
    expect(kiosk).toContain(".kf-map.is-large { max-height: 82vh;");
  });

  it('taking the whole area and picking tables are exclusive', () => {
    const store = src('store/tablet.store.ts');
    // Each clears the other: a booking is the tables it named or the venue.
    expect(store).toContain('return { floorSelections: next, wholeAreaId: undefined };');
    expect(store).toContain('setWholeArea: (hallId) => { set({ wholeAreaId: hallId, floorSelections: {} }); },');
  });

  it('the whole-area button is offered only when every table is free', () => {
    expect(kiosk).toContain('const canTakeWhole = !!area && wholeAreaAvailable(area.id, occupancy, byHall);');
    expect(kiosk).toMatch(/disabled=\{!canTakeWhole && wholeAreaId !== area\.id\}/);
  });
});

describe('what the booking is sent with', () => {
  it('the tables chosen, and the area when the whole of it is taken', () => {
    // Inside the payload the booking is sent with — `floorTables` is also the
    // name of the local, so asserting it anywhere in the file passes against
    // a payload that has lost it.
    const at = summary.indexOf('const menuFields = {');
    expect(at, 'menuFields is gone — this test needs rewriting').toBeGreaterThan(-1);
    const payload = summary.slice(at, summary.indexOf('};', at));
    expect(payload).toContain('floorTables,');
    expect(payload).toContain('wholeHall: !!wholeAreaId,');
    // The server has to know WHICH venue a whole-area booking is for, and a
    // dining session has no hall picker to have set it.
    expect(summary).toContain('hallId: wholeAreaId || selectedHallId || undefined,');
  });

  it('the head count CAPS the seating, and stays typed', () => {
    // Superseded the earlier "the sum wins" rule: a banquet's head count is
    // what the per-person package is priced on, so the map fits inside it
    // rather than redefining it. With nothing typed the tables supply it.
    expect(summary).toContain('const seated = seatedGuests(floorTables);');
    expect(summary).toContain('const bookingGuests = guestCountOf(floorTables, guestCount);');
    expect(summary).toContain('const over = seatingOverflow(floorTables, guestCount);');
    expect(summary).toContain('guestCount: bookingGuests,');
    // The field is an input, not a readout: it is the cap, which is a
    // decision rather than a derived figure.
    const field = summary.slice(summary.indexOf("t('guest_count')"));
    expect(field.slice(0, 600)).toContain('type="number"');
  });

  it('the kiosk map stops at the head count rather than letting Confirm fail', () => {
    expect(kiosk).toContain('const remaining = seatsRemaining(selections, guestCount);');
    // Picking seats a table full, or up to what is left — never past it.
    expect(kiosk).toContain('toggleFloorTable(table.id, Math.min(table.seats, remaining));');
    // And the stepper stops there too.
    expect(kiosk).toContain('disabled={guests >= table.seats || full}');
  });

  it('but the cap is enforced on the SERVER as well', () => {
    // The kiosk's steppers are a courtesy; a stale bundle reaches the API too.
    const api = readFileSync(join(WEB, '..', '..', 'api', 'src', 'modules', 'events', 'event.floorTables.ts'), 'utf8');
    expect(api).toContain('seatingOverflow(selections, request.guestCount)');
  });

  it('a new guest starts with an empty map', () => {
    const store = src('store/tablet.store.ts');
    const reset = store.slice(store.indexOf('reset: () => {'));
    expect(reset).toContain('floorSelections: {}');
    expect(reset).toContain('wholeAreaId: undefined');
  });
});

describe('the admin map', () => {
  it('is a picture of one DAY, and the date is what it is keyed on', () => {
    expect(admin).toContain("const DAY_KEY = (day: string) => ['floor-map-day', day] as const;");
    expect(admin).toContain('queryKey: DAY_KEY(day),');
  });

  it('clicking a taken table opens the booking that holds it', () => {
    expect(admin).toContain('setOpenBooking(holder ?? null);');
    expect(admin).toContain('const bookingCard = (b: MapBooking) =>');
  });

  it('occupancy is NOT drawn while the map is being edited', () => {
    // There the map is furniture being arranged; colouring it by an evening's
    // bookings would say a table cannot be moved when it can.
    expect(admin).toContain("!editing && holders.has(table.id) ? 'is-taken' : '',");
  });

  it('the schedule covers past AND future', () => {
    expect(admin).toMatch(/schedFrom = useMemo\(\(\) => dayKey\(new Date\(Date\.parse\(`\$\{day\}T00:00:00Z`\) - 30/);
    expect(admin).toMatch(/schedTo = useMemo\(\(\) => dayKey\(new Date\(Date\.parse\(`\$\{day\}T00:00:00Z`\) \+ 30/);
    expect(admin).toContain("className={`fm-sched-row${bookingDay < dayKey(new Date()) ? ' is-past' : ''}`}");
  });

  it('and is only fetched once it has been opened', () => {
    expect(admin).toContain('enabled: scheduleShown,');
  });

  it('a manual booking sends the picked tables and lets the server derive the count', () => {
    expect(admin).toContain('floorTables: pickedList,');
    expect(admin).toContain('wholeHall: wholeArea,');
  });

  it('the printed plan is asked for by area AND day', () => {
    expect(admin).toContain('floorMapService.printArea(area.id, day)');
    expect(src('services/floorMap.service.ts')).toMatch(/\/floor-map\/areas\/\$\{id\}\/print`, \{\s*params: \{ date \}, responseType: 'blob'/);
  });

  it('a whole-area booking is said over the plan — no single table carries it', () => {
    expect(admin).toContain('!editing && wholeAreaBooking && (');
  });
});

describe('one drawing, two screens', () => {
  it('the kiosk and the admin map both draw the shared plan or the shared geometry', () => {
    // The kiosk uses the shared component; the admin page keeps its editor SVG
    // (drag handles, resize) but takes its geometry from the same helpers, so
    // a table cannot be one size on one screen and another on the other.
    expect(kiosk).toContain('<FloorPlanView');
    for (const helper of ['tableSize', 'chairsFor', 'areaSize']) {
      expect(plan, `plan: ${helper}`).toContain(helper);
      expect(admin, `admin: ${helper}`).toContain(helper);
    }
  });

  it('the plan\'s styles are exported, not copied into each caller', () => {
    expect(plan).toContain('export const FLOOR_PLAN_CSS');
    expect(kiosk).toContain('${FLOOR_PLAN_CSS}');
  });
});
