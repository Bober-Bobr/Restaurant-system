/**
 * The id of the ONLY hall a restaurant can book into, or null when the guest
 * (or the manager) genuinely has a choice to make.
 *
 * Most restaurants on the platform have exactly one hall, and for them every
 * hall picker was a one-item dropdown that still opened blank — a step that
 * cannot be got wrong, cannot be got right either, and is the single most
 * common cause of an event saved with no hall on it. Where this returns an id,
 * the picker is a formality and the field is filled in up front.
 *
 * Two rules are deliberate:
 *
 * - **Only ACTIVE halls count.** A hall switched off is not bookable, so a
 *   restaurant with one active hall and two retired ones still has no choice —
 *   even though the admin form lists all three, so that an event already
 *   assigned to a retired hall can still be opened and edited.
 * - **`isActive` missing means active.** The public payload the kiosk reads has
 *   already filtered by it; treating an absent flag as "off" would make the sole
 *   hall of every restaurant invisible to this and quietly do nothing.
 *
 * The caller applies it only to an EMPTY field, never as a correction: with the
 * default applied once, clearing the field back to "no hall" has to stay
 * possible, and an effect that re-asserted itself would make that impossible.
 */
export type HallChoice = { id: string; isActive?: boolean };

export function soleHallId(halls: readonly HallChoice[] | null | undefined): string | null {
  const bookable = (halls ?? []).filter((hall) => hall.isActive !== false);
  return bookable.length === 1 ? bookable[0]!.id : null;
}
