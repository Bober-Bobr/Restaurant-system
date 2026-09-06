/**
 * Whether the kiosk should keep the booking it already has, or start clean.
 *
 * The tablet is a shared device, so the menu page has always cleared the table
 * selection on mount: the next guest must not inherit the last one's order. That
 * rule also threw away the CURRENT guest's work on a page reload or a browser
 * Back, which is the same event as far as React is concerned.
 *
 * The four inputs are the whole distinction:
 *
 * - `prefill` — the Events page handed a draft over ("Change Menu").
 * - `fromSummary` — the guest pressed Back on the Summary to edit their picks.
 * - `storedDraft` — a draft survives in **sessionStorage**, which is the signal
 *   that this is a reload or a Back within one visit rather than a new guest.
 *   Session storage dies with the tab, so tomorrow's guest starts clean without
 *   anything having to remember to clear it.
 * - `sameRestaurant` — a draft from a different restaurant's kiosk is not this
 *   guest's booking; its dish and package ids do not even exist here.
 *
 * Leaving the kiosk deliberately (the header's "← events", the chooser's Back)
 * clears the draft, because that is the "I am done" gesture. An accidental tap
 * costs the guest their picks; the alternative — a draft that outlives the guest
 * who made it — hands the next guest somebody else's order, which is worse.
 */
export const TABLET_DRAFT_KEY = 'vmenu-tablet-draft';

export type DraftDecision = {
  prefill: boolean;
  fromSummary: boolean;
  storedDraft: boolean;
  sameRestaurant: boolean;
};

export function shouldKeepSelection({
  prefill, fromSummary, storedDraft, sameRestaurant,
}: DraftDecision): boolean {
  if (prefill || fromSummary) return true;
  return storedDraft && sameRestaurant;
}
