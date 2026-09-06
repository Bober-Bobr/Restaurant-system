import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Three things about the kiosk's chrome: that a guest can always get back out,
 * that the paid upgrade for a course is offered where the course is chosen, and
 * where the Additional filter sits.
 *
 * Source-reading, in the style of `translate.test.ts` and `tabletSettings.test.ts`:
 * the web suite has no DOM, and each of these is a question about what the
 * markup says.
 */
const SRC = join(__dirname, '..');
const menu = readFileSync(join(SRC, 'pages', 'TabletMenuPage.tsx'), 'utf8');

describe('there is always a way back', () => {
  it('the table-category chooser has a Back button', () => {
    // It is a full-screen overlay on top of the menu page, so the page's own
    // "← events" button is behind it: without this, choosing a table was the
    // only way out of the kiosk.
    expect(menu).toContain('onBack: () => void;');
    // Leaving clears the draft — see store/tabletDraft.ts.
    expect(menu).toMatch(/onBack=\{\(\) => \{ reset\(\); navigate\('\/'\); \}\}/);
  });

  it('the button is rendered unconditionally, not only on the second step', () => {
    // It used to be `{gated && eventType && (<button …>)}` — so a restaurant
    // whose tables are all one event type had no back button at all.
    const bar = menu.slice(menu.indexOf('{/* Top bar */}'));
    const button = bar.slice(bar.indexOf('<button'), bar.indexOf('</button>'));
    expect(button).not.toMatch(/^\s*\{gated/);
    expect(button).toContain("if (gated && eventType) setEventType(null); else onBack();");
  });

  it('it steps back through the chooser before leaving it', () => {
    // From the table list to the event types, and only then out — a Back that
    // jumped straight out of a two-step chooser would lose the first step.
    expect(menu).toMatch(/\{gated && eventType \? t\(EVENT_TYPE_LABEL\[eventType\]\) : t\('back'\)\}/);
  });

  it('every other overlay on the page can still be dismissed', () => {
    // The chooser was the only gap; these already closed and must keep doing so.
    for (const overlay of ['DishSwapModal', 'ExtraReplaceModal', 'Lightbox']) {
      const at = menu.indexOf(`<${overlay}`);
      expect(at, `${overlay} is gone`).toBeGreaterThan(-1);
      expect(menu.slice(at, at + 700), `${overlay} has no onClose`).toContain('onClose');
    }
  });
});

describe('a paid dish is offered where its course is chosen', () => {
  it('the course list carries the paid options of the same category', () => {
    expect(menu).toContain('paidOptions?: MenuItem[];');
    // …and the adult course section is actually handed them.
    expect(menu).toContain('paidOptions={paidCourseOptions}');
    expect(menu).toContain('onTogglePaid={togglePaid}');
    expect(menu).toMatch(/paidOptions\s*\n?\s*\.filter\(\(m\) => m\.category === cfg\.category && !includedIds\.has\(m\.id\)\)/);
  });

  it('only course categories, and only dishes actually on sale', () => {
    // Same rows the Additional section sells — one selection shown twice, so
    // adding a premium main here ticks it there too.
    expect(menu).toMatch(
      /COURSE_CATEGORIES\.includes\(item\.category\) && isSelectableAdditional\(item\)/,
    );
  });

  it('a dish the package already includes is not also sold', () => {
    expect(menu).toContain('const includedIds = new Set(free.map((o) => o.item.id));');
  });

  it('the price is shown, which is the whole point', () => {
    expect(menu).toMatch(/option\.paid && \(/);
    expect(menu).toContain('+ {formatSum(item.priceCents)}');
  });

  it('buying one does not count as making the free choice', () => {
    // `full` collapses the list once the package's picks are made. A paid
    // addition is not one of them, so it is counted from the free options only.
    expect(menu).toContain('const selectedCount = group.free.filter((o) => group.isSelected(o.item.id)).length;');
  });

  it('a chosen paid dish stays visible when the list collapses', () => {
    // Otherwise it looks as though the dish the guest just paid for was dropped.
    expect(menu).toContain('const displayItems = collapsed ? group.options.filter(isChosen) : group.options;');
  });

  it('it toggles as a paid extra, leaving the free course alone', () => {
    expect(menu).toContain('if (option.paid) { onTogglePaid?.(item.id); return; }');
    expect(menu).toContain('const togglePaid = (id: string) => setQuantity(id, (selectedItems[id] ?? 0) > 0 ? 0 : 1);');
    // A checkbox, not a radio, even inside a single-select course: it is an
    // addition, not an alternative.
    expect(menu).toContain('const checkbox = option.paid || group.multi;');
  });

  it('the children\'s table is not offered adult extras', () => {
    // `CourseChoiceSection` is shared. Only the adult section passes them.
    expect((menu.match(/paidOptions=\{paidCourseOptions\}/g) ?? []).length).toBe(1);
  });
});

describe('the Additional filter runs down the left', () => {
  it('the filter and the dishes sit side by side', () => {
    expect(menu).toContain('<div className="flex flex-col gap-4 sm:flex-row sm:gap-5">');
  });

  it('the filter is a column with a fixed width, and the grid takes the rest', () => {
    expect(menu).toMatch(/sm:w-\[190px\] sm:shrink-0 sm:flex-col/);
    expect(menu).toContain('<div className="min-w-0 flex-1">');
  });

  it('on a phone it stays a strip across the top', () => {
    // A 190px rail beside a phone-width grid leaves one dish per row.
    expect(menu).toMatch(/className="scrollbar-none flex gap-2 overflow-x-auto pb-1 sm:/);
    expect(menu).toContain('sm:overflow-visible');
  });
});
