import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
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
  // The chosen dishes live in the cart panel now, not in a basket block above
  // the menu — sliced at its own markup for the reason above.
  const basket = sheet.slice(sheet.indexOf('className="sbo-cart-panel'), sheet.indexOf('<style>'));

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

  it('and the cart rows carry the same photo, small', () => {
    // The cart is read back to the host; a name alone is harder to check
    // against what was pointed at.
    expect(basket).toMatch(/const src = item\.photoUrl \? getPhotoUrl\(item\.photoUrl\) : null;/);
    expect(basket).toContain('className="sbo-thumb" src={src}');
    // And a row for a photoless dish keeps its column, or the names in a list
    // of eight would not line up.
    expect(basket).toContain('className="sbo-thumb is-empty"');
  });

  it('the grid is a grid, and fits a phone', () => {
    const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    // 168px is the floor a card needs for its stepper's two 44px buttons and
    // a readable field; 138 on a phone, where they come down to 40.
    expect(raw).toMatch(/\.sbo-grid \{[^}]*repeat\(auto-fill, minmax\(168px, 1fr\)\)/);
    expect(raw).toMatch(/@media \(max-width: 560px\)[\s\S]{0,2000}minmax\(138px, 1fr\)/);
  });
});

/**
 * The order sheet's second pass: the dishes get the sheet, and the order itself
 * is behind a cart button in the corner.
 *
 * The basket block above the menu was right that the total must not scroll away
 * and wrong about everything else — a party of forty orders a dozen dishes, so
 * it grew to a third of the sheet and left the menu a 52vh letterbox.
 */
describe('the order rides the footer, and the menu gets the sheet', () => {
  const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');

  it('there is no basket block above the dishes any more', () => {
    expect(sheet).not.toContain('className="sbo-basket"');
    // And the menu is no longer a letterbox with a fixed ceiling: the SHEET is
    // as tall as the screen allows and the menu is the row that gives.
    expect(raw).not.toMatch(/\.sbo-menu \{[^}]*max-height: 52vh/);
    expect(raw).toMatch(/\.sbo-sheet \{[\s\S]{0,260}height: min\(940px, 92vh\)/);
    expect(raw).toMatch(/\.sbo-sheet \{[\s\S]{0,320}grid-template-rows: auto minmax\(0, 1fr\) auto/);
  });

  it('the figures ride the footer, where nothing can scroll them away', () => {
    // That was the one thing the basket block got right, and it is the only
    // part of it that is kept.
    const foot = sheet.slice(sheet.indexOf('<footer className="sbo-foot">'), sheet.indexOf('<style>'));
    expect(foot).toContain("t('sbo_cart')");
    expect(foot).toContain('className="sbo-cart-badge"');
    expect(foot).toContain('formatSum(total)');
    // With both actions still in it, so a long menu cannot hide them.
    expect(foot).toContain("t('cancel')");
    expect(foot).toContain("t('sbo_send')");
  });

  it('the cart button is in the bottom-LEFT corner and the actions opposite', () => {
    // Where the ordering site puts it, which on a phone — where the sheet
    // fills the screen — is the same corner of the same screen.
    const foot = sheet.slice(sheet.indexOf('<footer className="sbo-foot">'), sheet.indexOf('<style>'));
    expect(foot.indexOf('className={`sbo-cart')).toBeLessThan(foot.indexOf('className="sbo-foot-acts"'));
    expect(raw).toMatch(/\.sbo-foot-acts \{ margin-left: auto;/);
    // A finger's target, like every other control on this screen.
    expect(raw).toMatch(/\.sbo-cart \{[\s\S]{0,300}min-height: 44px/);
  });

  it('the panel it opens is OPAQUE and anchored to that button', () => {
    // It sits over the dish grid; anything see-through makes both unreadable
    // at once.
    expect(raw).toMatch(/\.sbo-cart-panel \{[\s\S]{0,400}background: var\(--adm-bg\) !important/);
    expect(raw).toMatch(/\.sbo-cart-panel \{[\s\S]{0,300}bottom: calc\(100% \+ 10px\)/);
    expect(raw).toMatch(/\.sbo-foot \{[\s\S]{0,120}position: relative/);
    // And it is not rendered while closed, so nothing a reader cannot see is
    // in the tab order or findable by ctrl-F.
    expect(sheet).toMatch(/\{cartOpen && \(/);
  });

  it('Escape closes the CART and never the half-composed order', () => {
    const effect = sheet.slice(sheet.indexOf('if (!cartOpen) return;'));
    expect(effect.slice(0, 300)).toContain("e.key === 'Escape'");
    expect(effect.slice(0, 300)).toContain('setCartOpen(false)');
    expect(effect.slice(0, 400)).toContain("removeEventListener('keydown', onKey)");
    expect(effect.slice(0, 300)).not.toContain('onCancel');
  });

  it('the note for the kitchen moved into the cart, where the order is reviewed', () => {
    const panel = sheet.slice(sheet.indexOf('className="sbo-cart-panel'), sheet.indexOf('<style>'));
    expect(panel).toContain("t('sbo_comment')");
  });
});

describe('the categories are a rail, and pressing one SCROLLS', () => {
  const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');

  it('every category on the menu is in the rail, with its counts', () => {
    const rail = sheet.slice(sheet.indexOf('<nav className="sbo-cats"'), sheet.indexOf('className="sbo-menu"'));
    // Built from the SAME grouping the menu renders, or the rail offers a
    // category the dishes below do not have and the press goes nowhere.
    expect(rail).toMatch(/grouped\.map\(\(\{ category, items \}\)/);
    expect(rail).toContain('t(CATEGORY_LABEL_KEY[category])');
    expect(rail).toContain('{items.length}');
    // And the portions taken from it, which is what makes the rail answer
    // "where did I pick things" without opening the cart.
    expect(rail).toContain('takenIn[category]');
    expect(rail).toMatch(/taken > 0 &&/);
  });

  it('a press sets a POSITION rather than scrollIntoView', () => {
    // scrollIntoView scrolls every scrollable ancestor, and this one has the
    // dialog above it — the same reason the tier carousel centres by hand.
    const goTo = sheet.slice(sheet.indexOf('const goTo = ('), sheet.indexOf('const trackScroll'));
    expect(goTo).toContain('box.scrollTop = Math.max(0, section.offsetTop - 6)');
    expect(goTo).not.toContain('scrollIntoView');
    // offsetTop is read from the offset PARENT, so the scroller has to be one.
    expect(raw).toMatch(/\.sbo-menu \{[\s\S]{0,200}position: relative/);
  });

  it('the highlighted row is the one the reader is IN, not the first one visible', () => {
    // At the foot of a long category the next one's cards are on screen while
    // the dishes being read still belong to this one.
    const track = sheet.slice(sheet.indexOf('const trackScroll = ()'), sheet.indexOf('useEffect', sheet.indexOf('const trackScroll = ()')));
    expect(track).toContain('section.offsetTop - box.scrollTop <= 12');
    expect(track).toContain('else break;');
    // And before any scroll has happened it is the first category, because
    // that is what the menu is showing — not nothing.
    expect(sheet).toContain('const activeCategory = active ?? grouped[0]?.category ?? null;');
  });

  it('a search puts the scroller back to the top', () => {
    // It rewrites the whole list; leaving the scroll where it was lands the
    // reader in the middle of a list they have not seen.
    const effect = sheet.slice(sheet.indexOf('if (menuRef.current) menuRef.current.scrollTop = 0;'));
    expect(effect.slice(0, 120)).toContain('setActive(null)');
    expect(effect.slice(0, 160)).toMatch(/\}, \[search\]\)/);
  });

  it('on a tablet or phone it becomes a snapping ROW above the dishes', () => {
    // A 216px column at 860px leaves the dish grid two cards wide, and a
    // tablet is what this screen is used on.
    expect(raw).toMatch(/\.sbo-body \{[\s\S]{0,120}grid-template-columns: 216px minmax\(0, 1fr\)/);
    const phone = raw.slice(raw.indexOf('@media (max-width: 900px)'), raw.indexOf('@media (max-width: 560px)'));
    expect(phone).toMatch(/\.sbo-body \{ grid-template-columns: minmax\(0, 1fr\)/);
    expect(phone).toMatch(/\.sbo-cats \{[\s\S]{0,200}overflow-x: auto/);
    expect(phone).toMatch(/scroll-snap-type: x proximity/);
    // The sheet fills the screen there: a dimmed border around a dialog at
    // 390px is a strip of nothing taken out of the menu.
    expect(phone).toMatch(/\.sbo-sheet \{ height: 100%/);
    // And the panel is pinned to both edges, or a 520px panel hangs off a
    // 390px screen.
    expect(phone).toMatch(/\.sbo-cart-panel \{ left: 0; right: 0; width: auto;/);
  });

  it('and at 560px the footer becomes two rows rather than squeezing the send', () => {
    // Measured at 390px before the fix: the actions were left 229px beside the
    // cart and the send button — a sentence in Russian and Uzbek — wrapped to
    // two lines inside its own box, 88px tall. A primary action that looks
    // broken is worse than a taller footer.
    const phone = raw.slice(raw.indexOf('@media (max-width: 560px)'));
    expect(phone).toMatch(/\.sbo-foot \{ gap: 8px; flex-wrap: wrap; \}/);
    expect(phone).toMatch(/\.sbo-foot-acts \{ flex: 1 1 100%/);
    expect(phone).toMatch(/\.sbo-foot-acts button \{ flex: 1; \}/);
  });

  it('a dish is read back by its NAME, so the cart row gives it the width', () => {
    // Measured in the 470px panel the five-column row left the name 96px: a
    // long dish name came out as four letters and an ellipsis, in the one
    // place the order is read back to the host.
    expect(raw).toMatch(/\.sbo-cart-panel \.sbo-line \{ grid-template-columns: auto minmax\(0, 1fr\) auto 92px; \}/);
    expect(raw).toMatch(/\.sbo-cart-panel \.sbo-line > span\.sbo-caption \{ display: none; \}/);
    expect(raw).toMatch(/\.sbo-cart-panel \.sbo-line-name \{[\s\S]{0,160}-webkit-line-clamp: 2/);
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

describe('the two things a browser had to find', () => {
  const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

  it('a layout that hands `t` to a child FORWARDS the params', () => {
    // The banner printed "Table {table} is calling the waiter!" and "waiting
    // {minutes} min" literally, because the layout's helper was
    // `(key) => translate(key, locale)` — enough for a header with no
    // placeholder in it. TypeScript cannot catch it: a one-argument function
    // is assignable to a two-argument type, so the prop accepted it happily.
    //
    // Asserted for EVERY layout that passes `t` down, not just the one that
    // was wrong.
    const layouts = readdirSync(join(WEB, 'app')).filter((f) => f.endsWith('Layout.tsx'));
    const handers = layouts.filter((f) => raw(join('app', f)).includes('t={t}'));
    expect(handers.length).toBeGreaterThan(0);
    for (const file of handers) {
      const code = raw(join('app', file));
      expect(code, file).toMatch(/const t = \(key: TranslationKey, params\?: Record<string, string \| number>\) =>\s*translate\(key, locale, params\)/);
    }
  });

  it('and the waiting figure ticks, because the data does not', () => {
    // The poll returns the same call every six seconds and React Query keeps
    // the identity of deep-equal data, so nothing re-renders — the figure
    // would sit at whatever it was when the call arrived.
    const banner = raw('components/WaiterCallBanner.tsx');
    expect(banner).toMatch(/setInterval\(\(\) => tick\(\(n\) => n \+ 1\), 30_000\)/);
    expect(banner).toContain('clearInterval(timer)');
  });

  it('a dish card cannot be wider than the track it is given', () => {
    // Measured before the fix: a 158px card with 184px of content, so names,
    // prices and steppers hung 27px past the frame and over the next card —
    // "the dish cards and the text within them shift to the right". A grid
    // item cannot shrink below its min-content, so the min-content is what had
    // to give.
    const sheetRaw = raw('pages/SmallBanquetOrderSheet.tsx');
    // The stepper is the thing that could not shrink: two fixed buttons plus a
    // fixed field. Now a grid with a flexible middle.
    expect(sheetRaw).toMatch(/\.sbo-stepper \{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) 44px/);
    expect(sheetRaw).toMatch(/\.sbo-stepper input \{[^}]*min-width: 0/);
    expect(sheetRaw).toMatch(/\.sbo-stepper button \{[^}]*min-width: 0/);
    // And both boxes above it have to allow it.
    expect(sheetRaw).toMatch(/\.sbo-card \{[\s\S]{0,400}min-width: 0;/);
    expect(sheetRaw).toMatch(/\.sbo-card-body \{[^}]*min-width: 0/);
    // A long dish name must not be what decides the card's width either.
    expect(sheetRaw).toMatch(/\.sbo-card-name \{[\s\S]{0,420}overflow-wrap: anywhere/);
  });

  it('the basket\'s stepper keeps a width, where its column cannot give it one', () => {
    // There the stepper sits in an `auto` column, which sizes to min-content
    // — with a flexible middle that would squash the field to nothing.
    expect(raw('pages/SmallBanquetOrderSheet.tsx')).toMatch(/\.sbo-line \.sbo-stepper \{ width: 148px; \}/);
  });

  it('the touch targets survived the fix', () => {
    const sheetRaw = raw('pages/SmallBanquetOrderSheet.tsx');
    // The HEIGHT is what a thumb needs; the width is what had to flex.
    expect(sheetRaw).toMatch(/\.sbo-stepper button \{[^}]*min-height: 44px/);
    expect(sheetRaw).toMatch(/\.sbo-stepper input \{[^}]*height: 44px/);
  });
});
