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
 * the three answers stay three — banquet, service order, and nobody has chosen —
 * because the first two are priced in completely different ways and the third
 * must not quietly become one of them.
 */
const WEB = join(__dirname, '..');
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
const src = (rel: string) => strip(readFileSync(join(WEB, rel), 'utf8'));

const map = src('pages/FloorMapPage.tsx');
const wiz = src('pages/BookingWizardPage.tsx');
const layout = src('app/SupervisorLayout.tsx');
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

describe('the wizard asks FIRST, and the answer is optional', () => {
  it('all three options are offered together, including "decide later"', () => {
    // Leaving a question unanswered by pressing nothing is how people answer
    // it by accident, so the third option is a card of its own.
    const kinds = wiz.slice(wiz.indexOf("draft.stage === 1 && ("), wiz.indexOf("draft.stage === 2 && ("));
    for (const key of ['menu_kind_banquet', 'menu_kind_dining', 'menu_kind_skip']) {
      expect(kinds, key).toContain(key);
    }
  });

  it('choosing a type IS the step — it moves straight to the details', () => {
    expect(wiz).toMatch(/onClick=\{\(\) => patch\(\{ kind: value, stage: 2 \}\)\}/);
  });

  it('"decide later" reaches the map as NO kind, never as a banquet', () => {
    expect(wiz).toMatch(/const toMenuKind = \(kind: WizardKind\): MenuKind => \(kind === 'banquet' \|\| kind === 'dining' \? kind : null\)/);
    expect(wiz).toContain('kind: toMenuKind(kind)');
  });

  it('nothing chosen creates the booking with the MENU_NOT_SELECTED status', () => {
    expect(map).toMatch(/status: kind \? 'CONFIRMED' : 'MENU_NOT_SELECTED'/);
  });

  it('and the kind is written onto the booking as it is taken', () => {
    // A party whose supervisor walked away from the dish basket is still a
    // service-order evening.
    expect(map).toMatch(/\.\.\.\(kind \? \{ menuConfig: \{ sessionKind: kind \}/);
  });

  it('the map hands the new booking BACK rather than deciding what comes next', () => {
    const save = map.slice(map.indexOf('const saveBooking = async'), map.indexOf('const startAssigning'));
    expect(save).toMatch(/flow\.onCreated\(\{ eventNumber: created\.id, hallId: current\.id, guests \}\)/);
    expect(save).not.toContain('navigate(');
    expect(save).not.toContain('loadEventDraft');
  });

  it('"banquet" hands over to the KIOSK\'s own chooser, naming the booking', () => {
    // The same flow the Events page hands over to. Without `editingEventId`
    // the kiosk would create a second booking on confirm.
    const created = wiz.slice(wiz.indexOf('const onCreated = '), wiz.indexOf('const placeOrder = async'));
    expect(created).toContain('loadEventDraft({');
    expect(created).toMatch(/editingEventId: created\.eventNumber/);
    expect(created).toContain("sessionKind: 'banquet'");
    expect(created).toContain('floorLocked: true');
    // WITH THE RESTAURANT. The kiosk loads its menu, halls and packages from
    // `?restaurantId=`; without it the page rendered its chrome and no data.
    expect(created).toMatch(/navigate\(`\/tablet\?restaurantId=\$\{encodeURIComponent\(restaurantId\)\}&prefill=1`\)/);
  });

  it('"service order" opens the dish basket for the booking just created', () => {
    const created = wiz.slice(wiz.indexOf('const onCreated = '), wiz.indexOf('const placeOrder = async'));
    expect(created).toMatch(/if \(kind === 'dining'\) \{[\s\S]{0,120}stage: 4, created/);
    expect(wiz).toMatch(/draft\.stage === 4 && kind === 'dining' && draft\.created/);
  });

  it('"decide later" goes straight back to the map, saying what it saved', () => {
    const created = wiz.slice(wiz.indexOf('const onCreated = '), wiz.indexOf('const placeOrder = async'));
    expect(created).toMatch(/leave\(t\('bw_saved_no_menu'/);
  });

  it('leaving the basket does not undo the booking', () => {
    // Which is exactly the state "decide later" produces, and the Events page
    // already shows it.
    const cancel = wiz.slice(wiz.indexOf('onCancel={() => leave('));
    expect(cancel.slice(0, 160)).toContain('bw_saved_order_later');
    expect(cancel.slice(0, 160)).not.toContain('eventService');
  });

  it('a booking is never created twice — a reload on stage 4 reopens the basket', () => {
    expect(wiz).toMatch(/created: \{ eventNumber: number; hallId: string; guests: number \} \| null/);
    expect(wiz).toContain('useSessionDraft<Draft>(DRAFT_KEY');
  });
});

describe('placing the party\'s order', () => {
  const place = wiz.slice(wiz.indexOf('const placeOrder = async'), wiz.indexOf('const fullScreen'));

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

  it('the total is in the FOOTER, so a long menu cannot scroll it away', () => {
    // It used to be a basket block above the dishes, which kept the total on
    // screen and cost the menu a third of the sheet. The footer is a row of
    // the sheet's own grid, so it is on screen without taking the menu's room.
    // By the CLASS attribute, not by any mention: `['sbo-menu']` is also the
    // menu query's key, which appears near the top of the file.
    expect(sheet.indexOf('className="sbo-menu"')).toBeLessThan(sheet.indexOf('<footer className="sbo-foot">'));
    const foot = sheet.slice(sheet.indexOf('<footer className="sbo-foot">'));
    expect(foot).toContain('formatSum(total)');
    expect(foot).toContain("t('sbo_portions', { count: portions })");
  });

  it('it wears the floor\'s dark green, not the supervisor app\'s own look', () => {
    // It is the thing the waiter will be reading in an hour.
    expect(sheet).toMatch(/className="sb-floor sbo-root"/);
  });

  it('the steppers are big enough for a finger', () => {
    // The HEIGHT is what a thumb needs. The WIDTH had to become flexible —
    // two fixed buttons and a fixed field made the card's content wider than
    // the card, so everything in it hung out to the right (see
    // floorMapBooking.test.ts). The 44px column is on the grid instead.
    const raw = readFileSync(join(WEB, 'pages/SmallBanquetOrderSheet.tsx'), 'utf8');
    expect(raw).toMatch(/\.sbo-stepper button \{[^}]*min-height: 44px/);
    expect(raw).toMatch(/\.sbo-stepper \{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) 44px/);
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

describe('taking a booking is what the section is for', () => {
  const raw = readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8');

  it('"+ New booking" is in the HEADER, beside the tablet, and opens the wizard', () => {
    const book = layout.indexOf('to="/book"');
    const tablet = layout.indexOf('to={`/tablet?restaurantId=');
    expect(book).toBeGreaterThan(-1);
    // Next to the Tablet link, before it.
    expect(book).toBeLessThan(tablet);
    expect(layout.slice(book, tablet)).toContain("t('bw_new_booking')");
  });

  it('and is gone from the floor map\'s own toolbar', () => {
    const toolbar = map.slice(map.indexOf('<div className="fm-toolbar">'), map.indexOf('className="fm-tabs"'));
    expect(toolbar).not.toContain("t('fm_new_booking')");
    expect(map).not.toContain('setBooking(');
  });

  it('the wizard is its own route', () => {
    expect(src('app/App.tsx')).toMatch(/<Route path="\/book" element=\{<BookingWizardPage \/>\} \/>/);
  });

  it('every stage shows the numbered stages, named as headings, and a tip', () => {
    const stages = wiz.slice(wiz.indexOf('export const BookingStages'), wiz.indexOf('export const BookingWizardPage'));
    expect(stages).toContain('<ol className="bw-stages"');
    expect(stages).toContain('<h3 className="bw-stage-name">');
    expect(stages).toContain("aria-current={n === stage ? 'step' : undefined}");
    expect(stages).toContain('{stageTip(stage, kind, t)}');
    // Stages 1–2, the full-screen plan, and the basket all carry it.
    expect(wiz).toContain('{stages}');
    expect(wiz).toContain('header: stages,');
    expect(wiz).toContain('steps={stages}');
    expect(map).toContain('{flow && flow.header}');
    expect(sheet).toContain('{steps && <div className="sbo-steps">{steps}</div>}');
  });

  it('stage 4 is NAMED by the type — it is the banquet planner, the order, or the map', () => {
    const title = wiz.slice(wiz.indexOf('const stageTitle'), wiz.indexOf('const stageTip'));
    for (const key of ['bw_stage_menu_banquet', 'bw_stage_menu_dining', 'bw_stage_menu_skip']) expect(title).toContain(key);
  });

  it('the wizard is FULL SCREEN — outside the layout, so no masthead and no rail', () => {
    const app = src('app/App.tsx');
    const book = app.indexOf('<Route path="/book" element={<BookingWizardPage />} />');
    const layout = app.indexOf('<Route element={<SupervisorLayout />}>');
    expect(book).toBeGreaterThan(-1);
    // Before the layout's route opens, i.e. not one of its children.
    expect(book).toBeLessThan(layout);
    // It wears the section's look itself, on every stage, and has its own way out.
    expect((wiz.match(/className="adm-bg svr-theme bw-root"/g) ?? []).length).toBe(3);
    expect(wiz).toContain('className="adm-btn-ghost bw-close" onClick={onClose}');
    const raw = readFileSync(join(WEB, 'pages/FloorMapPage.tsx'), 'utf8');
    const flowRule = raw.slice(raw.indexOf('.fm-page.is-flow {'), raw.indexOf('}', raw.indexOf('.fm-page.is-flow {')));
    expect(flowRule).toContain('max-width: none; min-height: 100vh;');
  });

  it('the WHOLE plan is on screen — the frame is measured, and the drawing contained in it', () => {
    expect(map).toContain('setFitHeight(Math.max(200, Math.floor(window.innerHeight - top - 34)))');
    expect(map).toContain("style={flow && fitHeight ? { height: fitHeight } : undefined}");
    // Contained in BOTH directions at "Fit", not fitted to the width alone.
    expect(map).toContain("style={flow && fitHeight && zoom === 1 ? { width: '100%', height: '100%' } : { width: `${zoom * 100}%` }}");
    // And the wizard does not open zoomed in on a phone.
    expect(map).toMatch(/useState\(\(\) => \(!flow && typeof window/);
  });

  it('the tips are set to be READ — body-size type and a solid accent spine', () => {
    const css = wiz.slice(wiz.indexOf('.bw-tip {'));
    expect(css.slice(0, 400)).toContain('font-size: 16px');
    expect(css.slice(0, 400)).toContain('border-left: 5px solid var(--adm-accent)');
  });

  it('in the plan the details are FACTS with one way back, not fields typed twice', () => {
    const form = map.slice(map.indexOf('const bookingForm = ()'), map.indexOf("className={`fm-page"));
    expect(form).not.toMatch(/<input/);
    expect(form).toContain('onClick={flow.onBack}');
    // And the day is the wizard's — the plan has no date field of its own then.
    expect(map).toMatch(/\{!editing && !flow && \(\s*<div className="fm-daybar">/);
  });

  it('the head count typed on the details CAPS the seating', () => {
    expect(map).toMatch(/const seatCap = assigning \? assigning\.guestCount : \(flow\?\.guestCount \?\? null\) \|\| null;/);
    expect(map).toContain('const guests = seatCap ?? seated;');
  });

  it('the running count of picked tables rides the day row, not a second box above the plan', () => {
    // The stage's tip already says what to press; a callout saying it again
    // only pushed the plan down a screen that is meant to be the plan's.
    expect(map).toMatch(/\{flow \? null : booking \? \(\s*<div className="fm-callout" role="status">/);
    const row = map.slice(map.indexOf('{!editing && flow && ('), map.indexOf('{!editing && !flow && ('));
    expect(row).toContain('className="fm-flow-picked"');
    expect(row).toContain("t('fm_picked_tables', {");
  });

  it('and the PLAN beckons — the free tables, never the taken ones', () => {
    // Inviting a press on a taken table is inviting a 409.
    expect(map).toMatch(/\$\{booking \|\| assigning \? ' is-booking' : ''\}/);
    expect(raw).toMatch(/\.fm-svg\.is-booking \.fm-table-group:not\(\.is-taken\):not\(\.is-partly\):not\(\.is-picked\) \.fm-top/);
    expect(raw).toContain('@keyframes fm-beckon');
    const reduced = raw.slice(raw.indexOf('@media (prefers-reduced-motion: reduce) {\n          .fm-svg.is-booking'));
    expect(reduced.slice(0, 160)).toContain('animation: none');
    expect(reduced.slice(0, 160)).toContain('stroke-opacity');
  });

  it('the DAY is asked on the details, before the plan it is drawn for', () => {
    const details = wiz.slice(wiz.indexOf('draft.stage === 2 && ('));
    expect(details).toMatch(/type="date" value=\{draft\.day\}/);
    expect(details.indexOf("t('fm_day')")).toBeLessThan(details.indexOf("t('event_time')"));
    expect(map).toContain('const asked = flow?.day ??');
  });
});
