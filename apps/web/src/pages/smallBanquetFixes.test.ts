import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chargedExtras } from '../utils/tablePricing';
import { existingMenuOf } from '../utils/eventMenuKind';
import type { Event } from '../types/domain';

/**
 * The Small Banquets round of fixes: stage 3 asks for tables, the Events
 * page's menu button reuses the wizard, extras are charged by the portion,
 * the Tablet link is hidden and the Photos page draws in pages.
 *
 * No DOM here, as everywhere in this suite: the arithmetic is called, the
 * screens are read.
 */
const WEB = join(__dirname, '..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const map = src('pages/FloorMapPage.tsx');
const wizard = src('pages/BookingWizardPage.tsx');
const events = src('pages/AdminEventsPage.tsx');

describe('an additional dish, charged two ways', () => {
  it('banquet: a tick, served to every guest', () => {
    expect(chargedExtras({ a: 1, b: 0 }, 40, false)).toEqual({ a: 40 });
  });

  it('Small Banquets: the portions ordered — price × quantity ÷ guests on the per-person rate', () => {
    const charged = chargedExtras({ plov: 6, salad: 0 }, 20, true);
    expect(charged).toEqual({ plov: 6 });
    // What usePriceCalculator then does with it, by hand: a 100 000 package
    // and six 50 000 portions over twenty guests is 115 000 a head.
    const rate = 100_000_00;
    const perHead = (rate * 20 + 50_000_00 * charged.plov) / 20;
    expect(perHead).toBe(rate + (50_000_00 * 6) / 20);
    expect(perHead).toBe(115_000_00);
  });

  it('both kiosk pages charge through it, so the running total and the summary agree', () => {
    expect(src('pages/TabletMenuPage.tsx')).toContain('chargedExtras(selectedItems, Math.max(guestCount, 1), extrasByQuantity)');
    expect(src('pages/TabletSummaryPage.tsx')).toContain("chargedExtras(selectedItems, guestCount, sectionOfRole(role) === 'SMALL_BANQUET')");
    // And a portion is a stepper there, not a tick.
    expect(src('pages/TabletMenuPage.tsx')).toContain('toggleMode={!extrasByQuantity}');
  });
});

describe('stage 3 will not book nothing', () => {
  it('has no Cancel booking button — the close button is the way out', () => {
    expect(map).not.toContain('flow.onCancel');
    expect(map).not.toContain("t('bw_cancel')");
  });

  it('an empty selection no longer means the whole area', () => {
    expect(map).toMatch(/const wholeArea = pickedList\.length === 0 && wholeChosen;/);
    expect(map).toMatch(/disabled=\{busyBooking \|\| !booking\.name\.trim\(\) \|\| nothing/);
  });

  it('the whole area is its own clearly marked button in the toolbar beside the plan', () => {
    const toolbar = map.slice(map.indexOf('<div className="fm-toolbar">'), map.indexOf('className="fm-tabs"'));
    expect(toolbar).toContain('fm-whole-btn');
    expect(toolbar).toContain("t('fm_book_whole_area')");
  });
});

describe('the Events page menu button, in Small Banquets', () => {
  const ev = (over: Record<string, unknown>) => ({ menuConfig: null, tableCategoryId: null, ...over }) as unknown as Event;

  it('knows which menu a booking already has', () => {
    expect(existingMenuOf(ev({}))).toBeNull();
    // Booked as a banquet, planner abandoned: still no menu — "Create".
    expect(existingMenuOf(ev({ menuConfig: { sessionKind: 'banquet' } }))).toBeNull();
    expect(existingMenuOf(ev({ tableCategoryId: 'tc' }))).toBe('banquet');
    expect(existingMenuOf(ev({ menuConfig: { diningOrder: { orderId: 'o', placedAt: '', lines: [{ menuItemId: 'm', name: 'Plov', quantity: 4, unitPriceCents: 1 }], portions: 4, totalCents: 4 } } }))).toBe('dining');
  });

  it('opens the banquet planner pre-filled, told it is a banquet and that the tables are held', () => {
    const fn = events.slice(events.indexOf('const openSmallBanquetMenu'), events.indexOf("navigate('/book');"));
    expect(fn).toContain("sessionKind: 'banquet'");
    expect(fn).toContain('floorLocked: true');
    expect(fn).toContain('config: editingEvent.menuConfig ?? null');
  });

  it('opens a service order on its own dishes, and replaces the order rather than adding one', () => {
    expect(events).toContain('replaceOrder: true');
    expect(wizard).toContain("...(draft.replaceOrder ? { replace: true } : {})");
    expect(wizard).toContain('initial={draft.orderInitial ?? null}');
  });

  it('a booking with no menu goes through the wizard with its details and tables, and is UPDATED there', () => {
    expect(events).toContain('editing: editingEvent ? editingEvent.id : null');
    expect(events).toContain('tables,');
    expect(wizard).toContain('editingEventNumber: draft.editing ?? null');
    expect(map).toMatch(/editingNo !== null\s*\? await eventService\.update\(editingNo/);
    // Its own tables are not "taken" by itself.
    expect(map).toContain('dayData.bookings.filter((b) => b.eventNumber !== editingNo)');
  });

  it('is the section accent, not the kiosk gold', () => {
    const button = events.slice(events.indexOf('openSmallBanquetMenu : goToTabletWithDraft'), events.indexOf("t('edit_menu')"));
    expect(button).not.toContain('--rg-accent');
    expect(button).toContain('var(--adm-accent)');
  });
});

describe('temporary removals and the Photos page', () => {
  it('the Tablet link is off behind one flag', () => {
    expect(src('app/SupervisorLayout.tsx')).toContain('const SHOW_TABLET_LINK = false;');
  });

  it('the Photos page draws a page at a time and lets the browser defer the rest', () => {
    const page = src('pages/AdminPhotosPage.tsx');
    expect(page).toContain('photos.slice(0, shown)');
    expect(page).toContain('loading="lazy"');
    expect(page).toContain('content-visibility: auto');
    // The tile is not a full .adm-card any more.
    expect(page).not.toMatch(/className="adm-card adm-card-hover tablet-fade-up"/);
  });
});
