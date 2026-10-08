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

  it('is mounted on the SUMMARY in both sessions, and nowhere else', () => {
    // It used to sit on the menu page for a banquet evening, a page away from
    // the date and time that decide what is free. The summary is where those
    // fields are, so that is where the plan is — in both sessions.
    expect(summary).toContain('<KioskFloorSection date={eventDate} large guestCount={guestCount} t={t} />');
    expect(src('pages/TabletMenuPage.tsx'), 'the menu page carries the map again')
      .not.toContain('<KioskFloorSection');
    // Not behind a session test any more: both kinds of evening pick a room.
    expect(summary).not.toContain('surface.menu && <KioskFloorSection');
  });

  it('nothing is drawn until the guest has said WHEN', () => {
    // What is free is entirely a question about a day. Today's availability
    // shown against next Saturday's booking is worse than a prompt, because
    // the guest cannot tell it is the wrong day.
    expect(kiosk).toContain('enabled: !!map && !!date,');
    expect(kiosk).toContain("if (!date) {");
    expect(kiosk).toContain("t('fm_date_first')");
  });

  it('the plan FITS its section rather than being blown up past it', () => {
    // It was drawn at 150% of its frame (260% on a phone), so a whole venue
    // had to be dragged about in two directions to find a table.
    expect(kiosk).toContain('.kf-map .fp-svg { width: 100%; min-width: 0; }');
    // The only rule allowed to draw it wider is the phone one, and the cutoff
    // has to stay below a tablet's width — a tablet is what this kiosk runs on,
    // and at 768px the plan fits with a 61×35 table. Measured in a browser.
    const wide = kiosk.slice(0, kiosk.indexOf('@media (max-width: 699px)'));
    const widths = [...wide.matchAll(/\.fp-svg \{[^}]*\bwidth: (\d+)%/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w, 'the plan is wider than its frame again').toBeLessThanOrEqual(100);
    // Height is what it gets instead.
    expect(kiosk).toContain('.kf-map.is-large { max-height: 74vh;');
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
    expect(admin).toContain('const bookingCard = (b: MapBooking, clicked?: MapTable | null) =>');
  });

  it('and answers for THAT table: how many of its seats are taken', () => {
    // The card names every table the booking holds; a click on table 7 is
    // asking about table 7.
    expect(admin).toContain('setOpenTableId(table.id);');
    expect(admin).toContain('bookingCard(openBooking, areaTables.find((x) => x.id === openTableId) ?? null)');
    expect(admin).toContain("t('fm_seats_taken', {");
    // A whole-area booking has no per-table count, so the table reads as full
    // and its spare seats are not offered — the room is let as one.
    expect(admin).toContain('b.wholeHall ? clicked.seats : (seatedAt.get(clicked.id) ?? clicked.seats)');
    // A table with nothing on it says "free" rather than "0 of 6 taken".
    expect(admin).toContain("? t('fm_seats_taken', { seated: seatedAt.get(table.id) ?? table.seats, seats: table.seats })");
  });

  it('draws a part-filled table differently from a full one', () => {
    // The printed sheet has always distinguished them; the map drew both the
    // same, so the paper and the screen disagreed about the same room.
    expect(admin).toContain("!editing && fill === 'partly' ? 'is-partly' : '',");
    expect(admin).toContain('const fill = tableFill(table, holders, seatedAt);');
    // The fill carries it, as on the sheet.
    expect(admin).toContain('.fm-table-group.is-partly .fm-top { fill: var(--fm-partly);');
    // …and it must come AFTER the is-taken rule: a part-filled table carries
    // both classes and the two rules are equally specific.
    expect(admin.indexOf('.fm-table-group.is-partly .fm-top'))
      .toBeGreaterThan(admin.indexOf('.fm-table-group.is-taken .fm-top'));
    // The legend gains the third swatch, and the count only when there are any.
    expect(admin).toContain("t('fm_partly')");
    expect(admin).toContain('{partlyHere > 0 && <span>');
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

  it('the printed plan is asked for by area, day, LANGUAGE and timezone', () => {
    // The sheet is translated whole on the server and cannot be switched once
    // it is on paper; and a booking's time is an instant, so printed as UTC a
    // 19:00 banquet came out as 14:00.
    expect(admin).toContain('floorMapService.printArea(area.id, day, locale)');
    expect(src('services/floorMap.service.ts'))
      .toContain("params: { date, lang, tz: -new Date().getTimezoneOffset() }, responseType: 'blob'");
  });

  it('a whole-area booking is said over the plan — no single table carries it', () => {
    expect(admin).toContain('!editing && wholeAreaBooking && (');
  });

  it('shows the bookings that name this area and hold no table', () => {
    // Every booking made on the Events page is one — that form has a hall
    // picker and no table picker — and they were nowhere on the map at all,
    // which is what "events created for a hall do not appear" was.
    expect(admin).toContain('unassignedBookings(occupancy, current.id)');
    expect(admin).toContain('!editing && pendingHere.length > 0 && (');
    expect(admin).toContain("t('fm_pending_head', { count: pendingHere.length })");
  });

  it('and lets the admin give one its tables from the plan', () => {
    expect(admin).toContain('const startAssigning = (b: MapBooking) => {');
    // A PATCH carrying the tables ONLY: the rest of the evening was decided on
    // the Events page and must not be rewritten from the map.
    expect(admin).toContain('eventService.update(assigning.eventNumber, { floorTables: pickedList, hallId: current.id })');
    expect(admin).toContain('if (booking || assigning) {');
    // Stopping at the head count the booking is already priced on.
    expect(admin).toContain('seatsRemaining(Object.entries(next).map(');
  });

  it('but does not draw them as holding a table, because they hold none', () => {
    // Which tables such a party sits at is exactly what nobody has decided;
    // choosing one on its behalf would invent an arrangement.
    const holders = tableHolders(day([b({ id: 'pending', floorTables: [] })]), byHall);
    expect(holders.size).toBe(0);
  });

  it('reads every time in the reader\'s own timezone, never UTC', () => {
    // `toISOString().slice(11, 16)` is UTC: Uzbekistan is five hours ahead, so
    // a 19:00 banquet displayed as 14:00 — the middle of lunch.
    expect(admin).toContain('const clockOf = (value: string | Date) => {');
    expect(admin).toContain('d.getHours()');
    expect(admin.match(/toISOString\(\)\.slice\(11/g), 'a UTC clock time is back on the map').toBeNull();
  });
});

describe('nothing on the admin map sits on its own edge', () => {
  it('no inline style carries !important — React silently DROPS the declaration', () => {
    // This is how the schedule card came to have no padding at all and its
    // text sat against the border: `style={{ padding: '16px !important' }}`
    // looks right and is thrown away. Swept across the whole app, because the
    // mistake is invisible at the call site.
    const files = [
      'pages/FloorMapPage.tsx', 'pages/KioskFloorSection.tsx', 'pages/KioskSessionChooser.tsx',
      'pages/TabletSummaryPage.tsx', 'pages/TabletMenuPage.tsx',
    ];
    for (const file of files) {
      for (const m of src(file).matchAll(/style=\{\{[^}]*\}\}/g)) {
        expect(m[0], `${file}: an inline !important is dropped by React`).not.toContain('!important');
      }
    }
  });

  it('the schedule card carries its padding in the stylesheet, where it works', () => {
    // `.adm-card` sets none of its own, so without this the card has none.
    expect(admin).toContain('.fm-sched-card { padding: 18px !important;');
    expect(admin).toContain('<section className="adm-card fm-sched-card">');
  });
});

describe('the summary is one column, in both sessions', () => {
  it('there is no sidebar left to squeeze the floor plan', () => {
    // Pricing used to be a sticky 0.7fr column down the right-hand side, which
    // left a plan of a whole venue 0.65 of a page to be read in.
    expect(summary).toContain('<div className="grid grid-cols-1 gap-4 lg:gap-6">');
    expect(summary, 'the two-column layout is back').not.toContain('lg:grid-cols-[1.3fr_0.7fr]');
    expect(summary, 'the sidebar is sticky again').not.toContain('lg:sticky lg:top-6 lg:self-start');
  });

  it('pricing sits near the bottom, BELOW the map and the other blocks', () => {
    const map = summary.indexOf('<KioskFloorSection');
    const pricing = summary.indexOf("t('pricing')");
    expect(map).toBeGreaterThan(-1);
    expect(pricing, 'pricing is above the map again').toBeGreaterThan(map);
  });

  it('and the actions are still the very last thing on the page', () => {
    // Which is what puts them at the bottom, now that the grid is one column.
    expect(summary.indexOf('<aside className=')).toBeGreaterThan(summary.indexOf('{/* ── Left column ── */}'));
    expect(summary.indexOf("t('actions')")).toBeGreaterThan(summary.indexOf("t('pricing')"));
  });

  it('the map is directly under the date and time it depends on', () => {
    const date = summary.indexOf("t('event_date')");
    const map = summary.indexOf('<KioskFloorSection');
    const overview = summary.indexOf("t('event_details')");
    expect(date).toBeLessThan(map);
    expect(map).toBeLessThan(overview);
  });
});

describe('every kiosk overlay can be left', () => {
  it('the session chooser has a Back — it is the FIRST step, so it leaves', () => {
    // Without one, the only way off a kiosk opened by mistake was to pick an
    // evening and back out of the screen after it.
    const chooser = src('pages/KioskSessionChooser.tsx');
    expect(chooser).toContain('onBack: () => void;');
    expect(chooser).toContain('<button type="button" onClick={onBack} className="kiosk-session-back">');
    expect(chooser).toContain('.kiosk-session-back {');
  });

  it('and leaving from it clears the draft, like every other exit', () => {
    const menu = src('pages/TabletMenuPage.tsx');
    const at = menu.indexOf('<KioskSessionChooser');
    expect(at).toBeGreaterThan(-1);
    expect(menu.slice(at, menu.indexOf('/>', at))).toContain("onBack={() => { reset(); navigate('/'); }}");
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


// ── The three table states, and the one place their colours live ────────────
// Taken is red, part-filled yellow, free left as it was. These are read off the
// source because there is no DOM here; what the browser actually paints was
// measured separately (see CLAUDE.md).

describe('the status colours are declared once', () => {
  const page = readFileSync(join(__dirname, 'FloorMapPage.tsx'), 'utf8');
  const styleBlock = (): string => {
    const start = page.indexOf('<style>{`');
    const end = page.indexOf('`}</style>');
    expect(start).toBeGreaterThan(-1);
    return page.slice(start + '<style>{`'.length, end);
  };

  it('declares every state as a custom property on the page root', () => {
    const tokens = /\.fm-page \{([\s\S]*?)\}/.exec(styleBlock())?.[1] ?? '';
    for (const name of ['--fm-free', '--fm-taken', '--fm-partly']) {
      expect(tokens, name).toContain(`${name}:`);
    }
  });

  it('paints the LEGEND from those same properties, never from its own copy', () => {
    // The swatches used to repeat the fills as literals beside the rules, so a
    // changed fill left the legend describing the colour the plan no longer
    // used — a key that disagrees with the map it explains.
    for (const token of ['var(--fm-free)', 'var(--fm-partly)', 'var(--fm-taken)']) {
      expect(page).toContain(`background: '${token}'`);
    }
    expect(page).not.toContain('rgba(148,163,184,0.55)');
    expect(page).not.toContain('rgba(148,163,184,0.26)');
  });

  it('gives the part-filled table DARK ink', () => {
    // Its number used to be drawn in the gold accent, which on yellow cannot be
    // read — and the number is what the table is being drawn for.
    expect(styleBlock()).toMatch(/\.fm-table-group\.is-partly \.fm-table-seats \{ fill: var\(--fm-partly-ink\)/);
    expect(styleBlock()).toMatch(/\.fm-table-group\.is-partly \.fm-table-label,/);
  });

  it('keeps occupancy off the map while it is being EDITED', () => {
    // The whole reason a red `is-taken` can coexist with the red `is-overlapping`
    // stroke: they are never on screen together. Drop the guard and a table
    // flagged as overlapping becomes indistinguishable from a booked one.
    for (const cls of ['is-taken', 'is-partly']) {
      expect(page).toContain(`!editing && `);
      expect(page).toMatch(new RegExp(`!editing && [^\\n]*'${cls}'`));
    }
  });

  it('has no backtick inside the style block, which would end it early', () => {
    // A prose comment written with code spans terminates the template literal
    // and the file stops compiling. That happened while these colours were
    // being written.
    expect(styleBlock()).not.toContain('`');
  });
});
