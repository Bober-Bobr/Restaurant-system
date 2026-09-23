import type { AdminRole } from '../store/auth.store';
import type { translate } from './translate';

/**
 * The kiosk's two kinds of session — Small Banquets only.
 *
 * The Small Banquets kiosk serves two different evenings from one tablet, and
 * which one it is decides what the guest is asked:
 *
 *   banquet  the section's own booking flow, unchanged — an area, a table
 *            package, the courses, the Additional dishes, a price.
 *   dining   the GENERAL DINING side. There is no package to sell and no
 *            areas to choose between, so the kiosk asks for the booking alone:
 *            who, when, and for how many. No menu, no prices, no event type.
 *
 * The choice is made once, on entering the kiosk, and lives in the tablet
 * store with the rest of the draft (session storage — it belongs to this
 * visit, not to the device).
 *
 * **The banquet kiosk is not offered the question.** It has one kind of
 * evening, and a chooser in front of it would be a screen to dismiss on every
 * booking. `kioskSessionsFor` is a POSITIVE list for the same reason the kiosk
 * itself is: a role added to the kiosk later gets the plain banquet flow until
 * somebody decides otherwise, rather than inheriting a question about a
 * product that restaurant may not sell.
 */

export type KioskSession = 'banquet' | 'dining';

export const KIOSK_SESSIONS: readonly KioskSession[] = ['banquet', 'dining'];

/**
 * What the kiosk falls back to: the flow every tablet has always had.
 *
 * A draft holds `sessionKind: KioskSession | null`, and **null means "not
 * asked yet"** rather than "banquet". The two have to be distinguishable or
 * the chooser could never tell a guest who picked Banquet from one who has not
 * answered, and would either show itself twice or not at all.
 */
export const DEFAULT_KIOSK_SESSION: KioskSession = 'banquet';

/**
 * Which parts of the kiosk a session has at all. One table rather than a
 * scatter of `session === 'dining'` tests across two very large pages: every
 * absence below was asked for together, and they are read in eight places.
 */
export type KioskSurface = {
  /** The dish menu — courses, categories, the running total. */
  menu: boolean;
  /** The areas/halls the booking can be put in. */
  areas: boolean;
  /** Table packages: the full-screen chooser and everything priced from it. */
  tablePackages: boolean;
  /** The "Additional" paid dishes section. */
  additionalDishes: boolean;
  /** Every price on the summary — per guest, the total, the deposit block. */
  pricing: boolean;
  /** The event-type menu and the honoree fields that follow from it. */
  eventType: boolean;
  /** Paid restaurant services ticked on the summary. */
  extraServices: boolean;
  /** The Additional Services button on the confirmed screen. */
  addonServices: boolean;
};

const BANQUET_SURFACE: KioskSurface = {
  menu: true, areas: true, tablePackages: true, additionalDishes: true,
  pricing: true, eventType: true, extraServices: true, addonServices: true,
};

/**
 * General Dining has none of them, and that is one decision rather than eight.
 * A table package is what prices a banquet booking; with no package there is
 * no per-guest rate, so the prices, the Additional dishes sold against that
 * rate and the paid services added to that total all go with it.
 */
const DINING_SURFACE: KioskSurface = {
  menu: false, areas: false, tablePackages: false, additionalDishes: false,
  pricing: false, eventType: false, extraServices: false, addonServices: false,
};

export function kioskSurface(session: KioskSession): KioskSurface {
  return session === 'dining' ? DINING_SURFACE : BANQUET_SURFACE;
}

/**
 * The sessions this kiosk offers a choice between, in the order they are shown.
 * One entry means no question is asked — the kiosk opens straight into it.
 *
 * General Dining is gated on `moduleCatering`: it IS that module's side of the
 * restaurant, so offering it to a restaurant that never bought it would take a
 * booking for a product it does not run.
 */
export function kioskSessionsFor(
  role: AdminRole | null | undefined,
  restaurant?: { moduleCatering?: boolean | null },
): KioskSession[] {
  if (role !== 'SUPERVISOR') return ['banquet'];
  return restaurant?.moduleCatering ? ['banquet', 'dining'] : ['banquet'];
}

/** Whether the kiosk asks the question at all. */
export const kioskAsksSession = (sessions: KioskSession[]) => sessions.length > 1;

/**
 * The session a kiosk should actually be in. A session kept in the draft can
 * outlive the answer — the module is withdrawn, or the draft is restored on a
 * tablet signed in as somebody else — and a dining booking taken on a kiosk
 * that no longer offers dining would be a booking nobody can price or serve.
 */
export function resolveKioskSession(
  stored: KioskSession | null | undefined,
  available: KioskSession[],
): KioskSession {
  return stored && available.includes(stored) ? stored : (available[0] ?? DEFAULT_KIOSK_SESSION);
}

/** What a booking still needs before it can be confirmed. */
export type BookingDraft = {
  customerName: string;
  customerPhone: string;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  hallId?: string;
  tableCategoryId?: string;
};

/**
 * The first thing still missing from a booking, as a translation key, or null
 * when it is ready. One copy for both sessions, because the difference between
 * them is exactly the two lines a dining booking does not have — written twice
 * it would be two lists that drift.
 *
 * A dining booking needs no area and no package: there is nothing to price and
 * the guest is seated on the night. It still needs a head count, which is what
 * the restaurant holds the table for.
 */
export function bookingMissing(
  session: KioskSession,
  draft: BookingDraft,
): Parameters<typeof translate>[0] | null {
  if (!draft.customerName.trim()) return 'customer_name_required';
  if (!draft.customerPhone.trim()) return 'customer_phone_required';
  if (!draft.eventDate) return 'event_date_required';
  if (!draft.eventTime) return 'event_time_required';
  if (kioskSurface(session).areas && !draft.hallId) return 'select_room_required';
  if (kioskSurface(session).tablePackages && !draft.tableCategoryId) return 'select_table_category_required';
  if (draft.guestCount < 1) return 'guest_count_required';
  return null;
}
