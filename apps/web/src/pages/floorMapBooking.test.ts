import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { callingOrders, newCalls, prune, tableLabel, waitedMinutes } from '../utils/waiterCalls';

/**
 * Taking a booking on the map, and what the kiosk is handed afterwards.
 *
 * Three things the first pass got wrong, all of them the same mistake in
 * different places: a screen asking again for something another screen has
 * already answered.
 *
 * Reads the source, the house style where there is no DOM.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const map = src('pages/FloorMapPage.tsx');
const store = src('store/tablet.store.ts');
const summary = src('pages/TabletSummaryPage.tsx');
const sheet = src('pages/SmallBanquetOrderSheet.tsx');

describe('the kiosk is not asked what the map already knows', () => {
  it('the session is handed over, so the "which evening?" chooser never opens', () => {
    // A guest shown "Banquet or General Dining?" one press after the
    // supervisor answered it is the kiosk contradicting the screen it was
    // opened from.
    expect(map).toMatch(/sessionKind: 'banquet',/);
    expect(store).toMatch(/sessionKind: d\.sessionKind \?\? null,/);
    // Still "not asked yet" when nobody has answered — the Events page's own
    // hand-over passes none, and the chooser must still appear there.
    expect(src('pages/AdminEventsPage.tsx')).not.toContain('sessionKind');
    // And the chooser is the thing that reads it.
    expect(src('pages/TabletMenuPage.tsx')).toContain('sessionKind === null');
  });

  it('the tables are already held, so the summary shows no plan', () => {
    expect(map).toMatch(/floorLocked: true,/);
    expect(store).toMatch(/floorLocked: !!d\.floorLocked,/);
    expect(summary).toMatch(/\{!floorLocked && \(\s*<KioskFloorSection/);
  });

  it('and the summary SENDS no tables, which is what stops it releasing them', () => {
    // This is the sharp end: the summary sends `floorTables` on an update, so
    // the empty selection this page never filled in would take the party's
    // tables away. Absent, not `[]` — an update that does not mention them
    // leaves them alone.
    expect(summary).toContain('...(floorLocked ? {} : { floorTables, wholeHall: !!wholeAreaId })');
    expect(summary).not.toMatch(/^\s*floorTables,$/m);
  });

  it('the fields it does ask for are prefilled from the booking', () => {
    // Who, when, how many and which room were all typed on the map; the
    // summary is left with the menu and the money.
    const handover = map.slice(map.indexOf('loadEventDraft({'), map.indexOf('floorLocked: true'));
    for (const field of ['customerName', 'customerPhone', 'guestCount', 'hallId', 'eventDate', 'eventTime']) {
      expect(handover, field).toContain(field);
    }
  });

  it('the store forgets both when the kiosk is reset', () => {
    // Otherwise the next guest inherits the supervisor's answers.
    const reset = store.slice(store.indexOf('reset: () => {'));
    expect(reset).toContain('sessionKind: null,');
    expect(reset).toContain('floorLocked: false,');
  });
});

describe('a booking is taken WITH the layout editor, not instead of it', () => {
  it('tables can be arranged while one is being drafted', () => {
    // Taking a booking is exactly when somebody finds the party needs the two
    // tables moved; being sent to the other editor would lose the draft.
    expect(map).toMatch(/const arranging = editingTables \|\| !!booking \|\| !!assigning;/);
    expect(map).toContain("arranging ? 'is-editable' : ''");
    expect(map).toMatch(/if \(!editing && !arranging\) return;/);
    expect(map).toContain("if (!arranging) {");
  });

  it('but the day\'s bookings stay drawn, which is why it is not `editing`', () => {
    // What is taken is the most important thing on the screen while a booking
    // is being taken.
    expect(map).toMatch(/const editing = mode !== 'view'/);
    expect(map).not.toMatch(/const editing = [^\n]*(booking|arranging)/);
  });

  it('the press SELECTS; reserving is an explicit button', () => {
    expect(map).toMatch(/if \(!editing && !booking && !assigning\) \{/);
    expect(map).toContain('const toggleReserved = (table: MapTable) => {');
    // The old behaviour — the press adding the table — is gone, so a press can
    // also mean "show me this" and a drag can mean "move it".
    const down = map.slice(map.indexOf('const onTablePointerDown'), map.indexOf('const onTableHandlePointerDown'));
    expect(down).not.toContain('setPicked(');
  });

  it('the selected table takes the panel, with Reserve first and highlighted', () => {
    const panel = map.slice(map.indexOf('const bookingTablePanel'), map.indexOf('const savedAtText'));
    expect(panel).toContain("t('fm_reserve_table', { label: table.label })");
    expect(panel).toContain("t('fm_release_table', { label: table.label })");
    expect(panel).toContain('fm-book-btn');
    // Before the table's own form, which is below it.
    expect(panel.indexOf('fm_reserve_table')).toBeLessThan(panel.indexOf('tablePanel(table)'));
    // And a way back to the booking's own fields.
    expect(panel).toContain("t('fm_back_to_booking')");
    // The dispatch prefers it while drafting.
    expect(map).toMatch(/: \(booking \|\| assigning\) && selectedTable \? bookingTablePanel\(selectedTable\)/);
  });

  it('a table somebody else holds cannot be reserved, and says why', () => {
    const panel = map.slice(map.indexOf('const bookingTablePanel'), map.indexOf('const savedAtText'));
    expect(panel).toMatch(/disabled=\{!!holder \|\| full\}/);
    expect(panel).toContain("t('fm_table_taken_by', {");
    // Two different reasons, both fixable, rather than one dead button.
    expect(panel).toContain("t('fm_seats_left_none')");
  });

  it('the primary act is separated from the tools in the toolbar', () => {
    expect(map).toContain('className="fm-toolbar-sep"');
    const raw = readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8');
    expect(raw).toMatch(/\.fm-toolbar-sep \{/);
    // Hidden on a phone, where the buttons stack and a vertical rule would be
    // a 1px tick in the middle of nowhere.
    expect(raw).toMatch(/@media \(max-width: 640px\) \{ \.fm-toolbar-sep \{ display: none; \} \}/);
  });
});

describe('the dish basket shows the food', () => {
  // Two places resolve a dish photo — the card and the basket row — so each is
  // sliced on its OWN. Asserting the expression appears in the file passes with
  // either one gutted, which is exactly what a break-check found: the same trap
  // as the PDF's dash assertion and the owner-nav's opening tag.
  const card = sheet.slice(sheet.indexOf('const DishCard = '), sheet.indexOf('export const SmallBanquetOrderSheet'));
  const basket = sheet.slice(sheet.indexOf('className="sbo-basket"'), sheet.indexOf('className="sbo-menu"'));

  it('every dish card carries its photograph', () => {
    expect(card).toMatch(/const src = item\.photoUrl \? getPhotoUrl\(item\.photoUrl\) : null;/);
    expect(card).toContain('loading="lazy"');
    expect(card).toMatch(/<img src=\{src\}/);
  });

  it('a dish with no photo gets a lettered tile, not a broken image', () => {
    // Half a menu photographed and half not is the normal state of a
    // restaurant's library.
    expect(card).toMatch(/className="sbo-shot is-empty"/);
    expect(card).toContain('name.trim().slice(0, 1).toUpperCase()');
  });

  it('the thumbnail opens full size, because it is a reminder not a look', () => {
    expect(card).toContain('onZoom(src)');
    expect(sheet).toMatch(/\{zoom && <Lightbox src=\{zoom\} onClose=\{\(\) => setZoom\(null\)\} compact \/>\}/);
  });

  it('a chosen dish is RINGED as well as counted', () => {
    // In a grid of twenty, a badge alone is something you have to go looking
    // for.
    expect(card).toMatch(/sbo-card\$\{portions > 0 \? ' is-on' : ''\}/);
    const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(raw).toMatch(/\.sbo-card\.is-on \{[^}]*border-color: var\(--adm-accent\)/);
  });

  it('and the basket rows carry the same photo, small', () => {
    // The basket is read back to the host; a name alone is harder to check
    // against what was pointed at.
    expect(basket).toMatch(/const src = item\.photoUrl \? getPhotoUrl\(item\.photoUrl\) : null;/);
    expect(basket).toContain('className="sbo-thumb" src={src}');
    // And a row for a photoless dish keeps its column, or the names in a list
    // of eight would not line up.
    expect(basket).toContain('className="sbo-thumb is-empty"');
  });

  it('the grid is a grid, and fits a phone', () => {
    const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(raw).toMatch(/\.sbo-grid \{[^}]*repeat\(auto-fill, minmax\(150px, 1fr\)\)/);
    expect(raw).toMatch(/@media \(max-width: 560px\)[\s\S]{0,700}minmax\(132px, 1fr\)/);
  });
});

describe('"Table 7 is calling the waiter!"', () => {
  const layout = src('app/FoodEmployeeLayout.tsx');
  const banner = src('components/WaiterCallBanner.tsx');
  const order = (id: string, at: string | null, table: string | null = '7') =>
    ({ id, callPendingAt: at, tableNumber: table });

  it('the calls are the orders with a call pending, OLDEST first', () => {
    // A queue that puts the newest call on top sends somebody to the table
    // that has waited the least.
    const list = [
      order('b', '2026-10-14T19:10:00.000Z'),
      order('a', '2026-10-14T19:00:00.000Z'),
      order('quiet', null),
    ];
    expect(callingOrders(list).map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('an unreadable timestamp keeps its place rather than vanishing', () => {
    // A call nobody can see is the failure this exists to prevent.
    const list = [order('bad', 'not a date'), order('good', '2026-10-14T19:00:00.000Z')];
    expect(callingOrders(list).map((o) => o.id)).toEqual(['good', 'bad']);
    expect(waitedMinutes(order('bad', 'not a date'))).toBe(0);
  });

  it('a poll every six seconds does not sound the alert every six seconds', () => {
    const calling = [order('a', '2026-10-14T19:00:00.000Z')];
    expect(newCalls(calling, new Set())).toHaveLength(1);
    expect(newCalls(calling, new Set(['a']))).toHaveLength(0);
  });

  it('but a table that called, was served and called AGAIN does sound again', () => {
    // Acknowledging clears `callPendingAt`, which takes the order out of the
    // calling list — and `prune` is what lets the announced set forget it.
    const announced = new Set(['a']);
    expect(prune(announced, []).size).toBe(0);
    expect(newCalls([order('a', '2026-10-14T20:00:00.000Z')], prune(announced, []))).toHaveLength(1);
  });

  it('waiting is whole minutes and never negative', () => {
    const now = Date.parse('2026-10-14T19:05:00.000Z');
    expect(waitedMinutes(order('a', '2026-10-14T19:00:00.000Z'), now)).toBe(5);
    // A clock a little ahead of the server must not say "-1 minutes".
    expect(waitedMinutes(order('a', '2026-10-14T19:06:00.000Z'), now)).toBe(0);
  });

  it('a table with no number falls back to the code the waiter typed', () => {
    // "Table — is calling" would read as a bug.
    expect(tableLabel({ ...order('a', null, null), code: 'XQ4' })).toBe('XQ4');
    expect(tableLabel(order('a', null, ' 12 '))).toBe('12');
  });

  it('the banner names the table, and sounds the alert once per call', () => {
    expect(banner).toContain("t('fe_call_alert', { table: tableLabel(first) })");
    expect(banner).toContain('playCallAlert()');
    expect(banner).toMatch(/announced\.current = prune\(announced\.current, calling\)/);
    // Oldest first, so the banner names the table that has waited longest.
    expect(banner).toContain('const first = showing[0];');
  });

  it('it cannot acknowledge the call — that belongs at the table', () => {
    // Acknowledging from here would mean acknowledging a table the waiter has
    // not been to yet, which is the opposite of what it means.
    expect(banner).not.toContain('acknowledge');
    expect(banner).toContain("t('fe_call_alert_open')");
  });

  it('it is in the LAYOUT, so a call reaches the statistics tab too', () => {
    expect(layout).toContain('<WaiterCallBanner orders={callingNow} t={t} />');
    // Reading the same query key the orders page uses: one poll serves both,
    // and the badge and the banner cannot disagree about who is waiting.
    expect(layout).toMatch(/queryKey: \['wt-orders', 'OPEN'\]/);
    expect(layout).toContain('const callingNow = surface.waiterCalls ? callingOrders(');
    expect(layout).toMatch(/const calling = callingNow\.length;/);
  });

  it('and not on the floor that has no guest device', () => {
    expect(layout).toMatch(/enabled: !!accessToken && surface\.waiterCalls/);
  });

  it('the sound never throws, because the banner is the message', () => {
    const sound = src('utils/alertSound.ts');
    expect((sound.match(/catch/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // And it buzzes: the part that works with the volume down.
    expect(sound).toContain('navigator.vibrate?.(');
  });
});
