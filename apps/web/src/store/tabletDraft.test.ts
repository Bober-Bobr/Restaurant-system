import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLET_DRAFT_KEY, shouldKeepSelection } from './tabletDraft';

/**
 * A kiosk booking has to survive a reload and a browser Back, and must NOT
 * survive into the next guest's visit. Those pull in opposite directions, and
 * this is the rule that separates them.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const decision = (over: Partial<Parameters<typeof shouldKeepSelection>[0]> = {}) =>
  shouldKeepSelection({ prefill: false, fromSummary: false, storedDraft: false, sameRestaurant: true, ...over });

describe('resuming a booking, or starting a new one', () => {
  it('a fresh visit with nothing stored starts clean', () => {
    // The original kiosk rule, and it still holds: the next guest must not
    // inherit the last one's order.
    expect(decision()).toBe(false);
  });

  it('a stored draft is resumed — that is the reload and the Back', () => {
    // Both look identical to React: a mount with state already in the store.
    expect(decision({ storedDraft: true })).toBe(true);
  });

  it('a handoff from the Events page is resumed', () => {
    expect(decision({ prefill: true })).toBe(true);
  });

  it('returning from the Summary to edit is resumed', () => {
    expect(decision({ fromSummary: true })).toBe(true);
  });

  it('a draft from another restaurant\'s kiosk is not', () => {
    // Its dish and package ids do not exist here, so resuming it would price a
    // booking against a package the guest cannot see.
    expect(decision({ storedDraft: true, sameRestaurant: false })).toBe(false);
  });

  it('but an explicit handoff wins even across restaurants', () => {
    // `prefill` comes from a signed-in admin who chose this event; the ids in it
    // are that restaurant's by construction.
    expect(decision({ prefill: true, sameRestaurant: false })).toBe(true);
    expect(decision({ fromSummary: true, sameRestaurant: false })).toBe(true);
  });
});

describe('where the draft lives', () => {
  const store = read('store/tablet.store.ts');

  it('session storage, not local', () => {
    // It dies with the tab, so tomorrow's guest starts clean and nothing has to
    // remember to clear it. localStorage would outlive the guest who made it.
    expect(store).toContain('createJSONStorage(() => sessionStorage)');
    expect(store).not.toContain('localStorage');
    expect(store).toContain(`name: TABLET_DRAFT_KEY`);
    expect(TABLET_DRAFT_KEY).toBe('vmenu-tablet-draft');
  });

  it('the locale is not part of the booking', () => {
    // It is a preference of whoever is standing there, and it is re-chosen from
    // the header anyway.
    expect(store).toContain('partialize: ({ locale, ...draft }) => draft');
  });

  it('the Summary\'s fields are in the store, not in its useState', () => {
    // Component state does not survive a reload; the store does. These were
    // local until a guest lost a half-filled booking to a stray refresh.
    for (const field of [
      'eventType', 'eventNotes', 'birthdayPersonName', 'brideName', 'groomName', 'honoreePersonName',
    ]) {
      expect(store, `${field} is not in the store`).toContain(`  ${field}: '`);
    }
    const summary = read('pages/TabletSummaryPage.tsx');
    expect(summary, 'the Summary still owns them locally')
      .not.toMatch(/const \[eventNotes, setEventNotes\]\s*=\s*useState/);
    expect(summary).not.toMatch(/const \[customerName, setCustomerName\]\s*=\s*useState/);
  });

  it('the deposit keeps a text draft over the stored number', () => {
    // "1" on the way to "150" is an unfinished number, not a deposit of one
    // so'm — the same rule adminMenuDraft applies to a half-typed price.
    const summary = read('pages/TabletSummaryPage.tsx');
    expect(summary).toContain('const [depositText, setDepositText] = useState(');
    expect(summary).toContain('setDepositCents(parseSumToTiyin(depositText) ?? 0)');
  });
});

describe('leaving the kiosk clears it', () => {
  const menu = read('pages/TabletMenuPage.tsx');

  it('both exits reset the draft', () => {
    // "← events" and the chooser's Back are the "I am done" gesture. A reload is
    // not, which is the whole distinction.
    expect((menu.match(/reset\(\); navigate\('\/'\);/g) ?? []).length).toBe(2);
  });

  it('and confirming does, so the next guest starts clean', () => {
    expect(read('pages/TabletSummaryPage.tsx')).toMatch(/\breset\(\);/);
  });

  it('the mount decides through the shared rule, not its own condition', () => {
    expect(menu).toContain('shouldKeepSelection({');
    expect(menu).toContain('storedDraft: !!draft.selectedTableCategoryId,');
  });
});
