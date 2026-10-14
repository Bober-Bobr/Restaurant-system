import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { diningOrderOf, diningPortions, menuKindLabelKey, menuKindOf } from '../utils/eventMenuKind';
import type { Event } from '../types/domain';

/**
 * What kind of evening a booking is, from the map that asks to the page that
 * reads it back.
 *
 * The pure half is `utils/eventMenuKind.ts`; the chain around it is read from
 * the source, the house style where there is no DOM. What matters here is that
 * the three answers stay three — banquet, food service, and nobody has chosen —
 * because the first two are priced in completely different ways and the third
 * must not quietly become one of them.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const map = src('pages/FloorMapPage.tsx');
const sheet = src('pages/SmallBanquetOrderSheet.tsx');
const list = src('components/events/EventList.tsx');

const event = (over: Partial<Event> = {}) => ({ menuConfig: null, tableCategoryId: undefined, ...over } as Event);

describe('which kind a booking is', () => {
  it('the recorded answer wins', () => {
    expect(menuKindOf(event({ menuConfig: { sessionKind: 'dining' } as never }))).toBe('dining');
    expect(menuKindOf(event({ menuConfig: { sessionKind: 'banquet' } as never }))).toBe('banquet');
  });

  it('nothing chosen is NULL, not a banquet', () => {
    // Guessing would put a table package on a party that is eating a la carte.
    expect(menuKindOf(event())).toBeNull();
    expect(menuKindOf(event({ menuConfig: {} as never }))).toBeNull();
  });

  it('and a booking taken before any of this existed is read from its data', () => {
    // A wedding with a package and forty dishes on it is a banquet, whoever
    // typed it; "menu not selected" about one would be plainly wrong.
    expect(menuKindOf(event({ tableCategoryId: 'tc1' }))).toBe('banquet');
    expect(menuKindOf(event({ menuConfig: { secondCourseIds: ['d1'] } as never }))).toBe('banquet');
    expect(menuKindOf(event({ menuConfig: { extras: { d1: 2 } } as never }))).toBe('banquet');
  });

  it('a food-service order on it is enough on its own', () => {
    const withOrder = event({ menuConfig: { diningOrder: { lines: [] } } as never });
    expect(menuKindOf(withOrder)).toBe('dining');
  });

  it('"nobody has chosen" reuses the STATUS the product already has', () => {
    // Not a second string saying the same thing in the same words.
    expect(menuKindLabelKey(null)).toBe('status_menu_not_selected');
    expect(menuKindLabelKey('banquet')).toBe('menu_kind_banquet');
    expect(menuKindLabelKey('dining')).toBe('menu_kind_dining');
  });

  it('portions are added up from the LINES, not read off the figure beside them', () => {
    // One JSON column: a hand-edited row must not be able to claim a portion
    // count its own lines do not add up to.
    const withOrder = event({
      menuConfig: {
        diningOrder: {
          orderId: 'o1', placedAt: '', portions: 999, totalCents: 0,
          lines: [
            { menuItemId: 'm1', name: 'Plov', quantity: 40, unitPriceCents: 100 },
            { menuItemId: 'm2', name: 'Lagman', quantity: 20, unitPriceCents: 100 },
          ],
        },
      } as never,
    });
    expect(diningPortions(withOrder)).toBe(60);
    expect(diningOrderOf(withOrder)?.lines).toHaveLength(2);
    expect(diningOrderOf(event())).toBeNull();
    expect(diningPortions(event())).toBe(0);
  });
});

describe('the map asks, and the answer is optional', () => {
  it('all three options are offered together, including "decide later"', () => {
    // Leaving a question unanswered by pressing nothing is how people answer
    // it by accident, so the third option is a row of its own.
    for (const key of ['menu_kind_banquet', 'menu_kind_dining', 'menu_kind_skip']) {
      expect(map, key).toContain(key);
    }
    expect(map).toContain("t('menu_kind_optional')");
  });

  it('nothing chosen creates the booking with the MENU_NOT_SELECTED status', () => {
    expect(map).toMatch(/status: kind \? 'CONFIRMED' : 'MENU_NOT_SELECTED'/);
  });

  it('and the kind is written onto the booking as it is taken', () => {
    // A party whose supervisor walked away from the dish basket is still a
    // food-service evening.
    expect(map).toMatch(/\.\.\.\(kind \? \{ menuConfig: \{ sessionKind: kind \}/);
  });

  it('"banquet" hands over to the KIOSK\'s own chooser, naming the booking', () => {
    // The same flow the Events page hands over to. Without `editingEventId`
    // the kiosk would create a second booking on confirm.
    expect(map).toContain('loadEventDraft({');
    expect(map).toMatch(/editingEventId: created\.id/);
    // WITH THE RESTAURANT. The kiosk loads its menu, halls and packages from
    // `?restaurantId=`; without it the page rendered its chrome and no data at
    // all, which is what "no restaurant data loads when selecting a banquet"
    // was. The Events page's own hand-over has always passed it.
    expect(map).toMatch(/navigate\(`\/tablet\?restaurantId=\$\{encodeURIComponent\(restaurantId\)\}&prefill=1`\)/);
  });

  it('"food service" opens the dish basket for the booking just created', () => {
    expect(map).toMatch(/if \(kind === 'dining'\) \{[\s\S]{0,200}setOrdering\(\{/);
    expect(map).toMatch(/eventNumber: created\.id/);
  });

  it('leaving the basket does not undo the booking', () => {
    // Which is exactly the state "decide later" produces, and the Events page
    // already shows it.
    const cancel = map.slice(map.indexOf('onCancel={() => { setOrdering(null)'));
    expect(cancel.slice(0, 120)).toContain('setOrderError(null)');
    expect(cancel.slice(0, 120)).not.toContain('eventService');
  });
});

describe('placing the party\'s order', () => {
  const place = map.slice(map.indexOf('const placeOrder = async'), map.indexOf('const startAssigning'));

  it('sends ids and quantities only — the price is the server\'s', () => {
    expect(place).toMatch(/\.map\(\(\[menuItemId, quantity\]\) => \(\{ menuItemId, quantity \}\)\)/);
    expect(place).not.toContain('priceCents');
  });

  it('the ORDER is written first, then the booking\'s copy of the menu', () => {
    // If the second fails the party still gets fed; the reverse would be a
    // booking claiming food nobody was asked to cook.
    expect(place.indexOf('orderService.placeForBooking')).toBeLessThan(place.indexOf('eventService.update'));
  });

  it('and the booking\'s copy is a SNAPSHOT, like every other record here', () => {
    expect(place).toContain('nameSnapshot');
    expect(place).toContain('unitPriceCents: line.unitPriceCents');
    expect(place).toMatch(/sessionKind: 'dining'/);
  });

  it('an empty basket sends nothing at all', () => {
    expect(place).toMatch(/if \(items\.length === 0\) return;/);
  });
});

describe('the dish basket', () => {
  it('asks for the SECTION\'s menu, so it cannot be given another product\'s prices', () => {
    expect(sheet).toMatch(/menuService\.list\('smallBanquet'\)/);
  });

  it('offers nothing that is off the menu or out of stock', () => {
    expect(sheet).toMatch(/item\.isActive && !item\.isOutOfStock/);
  });

  it('portions are TYPED as well as stepped', () => {
    // A wedding orders eighty of something; nobody presses "+" eighty times.
    expect(sheet).toContain('inputMode="numeric"');
    expect(sheet).toMatch(/Math\.min\(MAX_PORTIONS, Number\(digits\)\)/);
  });

  it('the basket and its total sit ABOVE the menu', () => {
    // On a long menu the total would otherwise be off the screen while the
    // dishes are being picked.
    // By the CLASS attributes, not by any mention: `['sbo-menu']` is also the
    // menu query's key, which appears near the top of the file.
    expect(sheet.indexOf('className="sbo-basket"')).toBeLessThan(sheet.indexOf('className="sbo-menu"'));
  });

  it('it wears the floor\'s dark green, not the supervisor app\'s own look', () => {
    // It is the thing the waiter will be reading in an hour.
    expect(sheet).toMatch(/className="sb-floor sbo-root"/);
  });

  it('the steppers are big enough for a finger', () => {
    const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(raw).toMatch(/\.sbo-stepper button \{ min-width: 44px; min-height: 44px; \}/);
  });
});

describe('the Events page shows the type AND the menu', () => {
  it('a food-service booking lists what was ordered, not a count of it', () => {
    // "What did they order" is the question this column is read for.
    expect(list).toContain('const dining = diningOrderOf(event);');
    expect(list).toMatch(/dining \?/);
    expect(list).toContain("t('menu_kind_dining')");
    expect(list).toMatch(/\{line\.quantity\}× \{line\.name\}/);
    expect(list).toContain('diningPortions(event)');
  });

  it('and a banquet booking reads exactly as it did', () => {
    expect(list).toMatch(/\) : dishTypes > 0 \? \(/);
    expect(list).toContain("t('dishes_count', { count: dishTypes })");
  });

  it('the status badge already knows "menu not selected"', () => {
    // Which is why the map writes that status rather than inventing a second
    // notion of the same fact.
    expect(list).toContain("MENU_NOT_SELECTED: 'status_menu_not_selected'");
  });
});

describe('taking a booking is what the page is for', () => {
  const raw = readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8');

  it('the button sits with the two editors, and is the highlighted one', () => {
    // It was in the day bar beside "Print map", which read as another thing
    // you might do to the day rather than the point of the page.
    const toolbar = map.slice(map.indexOf('<div className="fm-toolbar">'), map.indexOf('</div>', map.indexOf('fm_edit\')}')));
    expect(toolbar).toContain("t('fm_new_booking')");
    expect(toolbar).toContain('fm-book-btn');
    // And before both editors in the row.
    expect(toolbar.indexOf("t('fm_new_booking')")).toBeLessThan(toolbar.indexOf("t('fm_edit_tables')"));
    // Not in the day bar any more.
    const daybar = map.slice(map.indexOf('className="fm-daybar"'), map.indexOf('fm-legend'));
    expect(daybar).not.toContain('fm_new_booking');
  });

  it('it only exists on the day view — an editor is not where a booking is taken', () => {
    expect(map).toMatch(/\{!editing && \(\s*<button type="button"\s*className=\{booking \?/);
  });

  it('pressing it asks for tables, in a callout rather than grey caption', () => {
    // The next thing that has to happen is a press on the plan, and nothing
    // else on the screen asked for it.
    expect(map).toMatch(/\{booking \? \(\s*<div className="fm-callout" role="status">/);
    expect(map).toContain("<strong>{t('fm_new_booking_hint')}</strong>");
    // With the running count, so "I have picked three" needs no counting.
    expect(map).toContain("t('fm_picked_tables', {");
    // And the button itself carries the same sentence as a tooltip.
    expect(map).toMatch(/title=\{booking \? undefined : t\('fm_new_booking_hint'\)\}/);
  });

  it('and the PLAN beckons — the free tables, never the taken ones', () => {
    // Inviting a press on a taken table is inviting a 409.
    expect(map).toMatch(/\$\{booking \|\| assigning \? ' is-booking' : ''\}/);
    expect(raw).toMatch(/\.fm-svg\.is-booking \.fm-table-group:not\(\.is-taken\):not\(\.is-partly\):not\(\.is-picked\) \.fm-top/);
    expect(raw).toContain('@keyframes fm-beckon');
    // Switched off under reduced motion, with the ring left in place — that is
    // the half that carries the meaning.
    const reduced = raw.slice(raw.indexOf('@media (prefers-reduced-motion: reduce) {\n          .fm-svg.is-booking'));
    expect(reduced.slice(0, 160)).toContain('animation: none');
    expect(reduced.slice(0, 160)).toContain('stroke-opacity');
  });

  it('the DAY is a field on the booking form, and it is the map\'s own day', () => {
    // Not a second date that could disagree with the plan underneath it.
    const form = map.slice(map.indexOf('const bookingForm = ()'), map.indexOf('{tableSteppers(null)}', map.indexOf('const bookingForm = ()')));
    expect(form).toMatch(/type="date" value=\{day\}/);
    expect(form).toContain("t('fm_day')");
    // Above the time, and both before the table steppers.
    expect(form.indexOf("t('fm_day')")).toBeLessThan(form.indexOf("t('event_time')"));
  });

  it('and changing it drops the tables picked from the other day\'s plan', () => {
    // A table that is free today may be taken tomorrow; keeping the picks
    // would offer a booking the server then refuses.
    const form = map.slice(map.indexOf('const bookingForm = ()'));
    const onChange = form.slice(form.indexOf('type="date" value={day}'), form.indexOf("t('event_time')"));
    expect(onChange).toContain('setDay(');
    expect(onChange).toContain('setPicked({})');
  });
});
