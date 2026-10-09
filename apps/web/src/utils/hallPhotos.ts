/**
 * A hall's photo gallery: the one place that says what the list IS.
 *
 * ── TWO COLUMNS, ONE GALLERY ───────────────────────────────────────────────
 * A hall carries `photoUrl` (one photo, there since the beginning) and `photos`
 * (a JSON array, added later). Every screen that only knows about one photo —
 * the kiosk's hall picker, the event form, the admin list — reads `photoUrl`,
 * so the gallery cannot simply move into the array: that would blank the room's
 * picture everywhere those screens are used.
 *
 * So the rule is: **`photos` is the whole gallery in order, and `photoUrl` is a
 * mirror of its first entry** — the cover. A single-photo reader shows the cover
 * and is none the wiser; a gallery reader shows the lot. `hallPhotoPayload` is
 * the only thing that writes the pair, so the two cannot drift.
 *
 * The combining was written out separately in the catering site, the
 * food-service site and the manager portal before this; the admin halls page
 * made a fourth, which is where one copy stops being tolerable.
 */

/**
 * How many photos one hall may hold. Mirrors `MAX_HALL_PHOTOS` in the API's
 * `hall.schema.ts`, which is what actually refuses the write —
 * `hallPhotos.test.ts` imports both and fails on a drift. A picker that let
 * somebody choose a 31st would lose every photo in that save to a 400.
 */
export const MAX_HALL_PHOTOS = 30;

/** The shape this module needs — not the full `Hall`, so a public payload fits too. */
export type HallPhotoFields = {
  photoUrl?: string | null;
  photos?: unknown;
};

/**
 * Every photo a hall has, cover first, with no duplicates.
 *
 * `photos` is typed `unknown` deliberately: it is a Json column, reachable with
 * psql and written by three different screens, so it may hold anything. A bare
 * `[...(hall.photos ?? [])]` spreads a STRING one character at a time, which
 * would turn one bad row into a gallery of forty-odd broken images rather than
 * a hall with no photos.
 */
export function hallPhotoList(hall: HallPhotoFields): string[] {
  const stored = Array.isArray(hall.photos) ? hall.photos : [];
  const all = [hall.photoUrl, ...stored].filter(
    (photo): photo is string => typeof photo === 'string' && photo.trim().length > 0,
  );
  return Array.from(new Set(all));
}

/**
 * The pair to WRITE for a chosen gallery. The first photo becomes the cover.
 *
 * `photoUrl` is `null` rather than `undefined` when the gallery is empty,
 * because these payloads are PATCHed: `JSON.stringify` drops an undefined key
 * entirely, so the server would keep the photo that was just removed and the
 * removal would look as though it had silently failed. (It did — a hall's photo
 * could not be cleared from the admin page at all before this.)
 */
export function hallPhotoPayload(photos: string[]): { photoUrl: string | null; photos: string[] } {
  const list = hallPhotoList({ photos });
  return { photoUrl: list[0] ?? null, photos: list };
}
