import PDFDocument from 'pdfkit';
import { areaSize, tableSize } from '../../utils/floorGeometry.js';
import { holdsTables, unassignedBookings, type BookingRow } from '../../utils/floorBooking.js';
import type { MapFeature } from './floorMap.features.js';
import type { AreaRow, TableRow } from './floorMap.repository.js';

/**
 * The printable plan of one area for one day — the sheet that goes on the pass.
 *
 * Laid out for somebody standing up with it: the map fills the page, every
 * table carries its number and its head count, taken tables are filled in and
 * free ones are left open, and the day's bookings are listed underneath with
 * who and when. A legend says which is which, because a photocopy in black and
 * white loses the colours and the fills have to survive that.
 *
 * Server-side, like every other export here, so the sheet is the same document
 * whoever prints it and whatever their browser is set to. The geometry it
 * needs is mirrored in utils/floorGeometry.ts and held to the web copy by
 * `floorGeometryAgreement.test.ts`.
 */

const A4_LANDSCAPE: [number, number] = [842, 595];
const MARGIN = 32;

/**
 * Every word on the sheet. The whole table is translated per language rather
 * than half of it: this is a document the admin prints and hands to staff, and
 * a plan whose heading is in Russian and whose legend is in English reads as a
 * bug on paper, where nobody can switch it.
 */
type Strings = {
  title: string;
  free: string;
  taken: string;
  /** Reserved, but not every seat at the table is taken. */
  partly: string;
  wholeArea: string;
  bookings: string;
  noBookings: string;
  guests: string;
  table: string;
  /** Heading over the bookings that name this area and hold no table. */
  noTables: string;
  /** "3 seats free", said of a table or a booking that is not full. */
  seatsFree: string;
};

const EN: Strings = {
  title: 'Floor plan',
  free: 'Free',
  taken: 'Reserved',
  partly: 'Partly reserved',
  wholeArea: 'Whole area reserved',
  bookings: 'Bookings on this day',
  noBookings: 'No bookings on this day.',
  guests: 'guests',
  table: 'Table',
  noTables: 'No tables assigned yet',
  seatsFree: 'seats free',
};

const RU: Strings = {
  title: 'План зала',
  free: 'Свободен',
  taken: 'Забронирован',
  partly: 'Забронирован частично',
  wholeArea: 'Вся зона забронирована',
  bookings: 'Брони на этот день',
  noBookings: 'На этот день броней нет.',
  guests: 'гостей',
  table: 'Стол',
  noTables: 'Столы ещё не назначены',
  seatsFree: 'мест свободно',
};

// uz avoids apostrophes, like every other uz string in this product.
const UZ: Strings = {
  title: 'Zal rejasi',
  free: 'Bosh',
  taken: 'Band qilingan',
  partly: 'Qisman band qilingan',
  wholeArea: 'Butun hudud band qilingan',
  bookings: 'Shu kundagi bronlar',
  noBookings: 'Shu kunga bron yoq.',
  guests: 'mehmon',
  table: 'Stol',
  noTables: 'Stollar hali tayinlanmagan',
  seatsFree: 'joy bosh',
};

const LANGS: Record<string, Strings> = { en: EN, ru: RU, uz: UZ };

/** The sheet's language. Anything unrecognised reads in English. */
export function stringsFor(lang: string | undefined): Strings {
  return LANGS[(lang ?? '').toLowerCase()] ?? EN;
}

export type PrintablePlan = {
  area: AreaRow;
  tables: TableRow[];
  bookings: BookingRow[];
  day: string;
  restaurantName?: string | null;
  /** The admin's chosen language: 'en' | 'ru' | 'uz'. */
  lang?: string;
  /**
   * The reader's offset from UTC in minutes, as `-getTimezoneOffset()` gives
   * it. Times are stored as instants, so printing `toISOString()` put a 19:00
   * banquet on the sheet as 14:00 — the middle of lunch.
   */
  tzOffsetMinutes?: number;
  strings?: Partial<Strings>;
};

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#d1d5db';
/**
 * Taken is RED, part-filled is YELLOW, free is left open.
 *
 * These were three greys, on the reasoning that the sheet gets photocopied and
 * a colour cannot be relied on. The greys were hard to read across a room, so
 * they are colours now — but **the photocopy argument still holds**, and it is
 * what fixes the particular red and yellow rather than any others: a mono
 * scanner sees BT.601 luma, and these three land at **95 / 207 / 255**, which
 * is still three plainly different greys in the order taken ‹ partly ‹ free.
 * Pick a darker yellow or a lighter red and the colour sheet still looks fine
 * while its photocopy goes flat — which is the failure nobody notices until
 * somebody is holding the copy.
 *
 * The red is also dark enough to carry the WHITE table number printed on it
 * (4.8:1), and the yellow light enough to carry the INK one (12.5:1); those two
 * are the real bounds on how bright either can go.
 */
const TAKEN_FILL = '#d92d20';
const PARTLY_FILL = '#ffd43b';
const FREE_FILL = '#ffffff';

const FEATURE_FILL: Record<string, string> = {
  zone: '#f3f4f6',
  water: '#dbeafe',
  stage: '#ede9fe',
  path: '#f9fafb',
  label: 'none',
};

/**
 * Who holds each table of this area, and which booking (if any) has the whole
 * of it. Pure, and exported, because it is the ARRANGEMENT the sheet is drawn
 * from — the drawing itself is PDFKit calls, which are not worth asserting.
 */
export function heldTables(bookings: BookingRow[], areaId: string) {
  const held = new Map<string, BookingRow>();
  const guests = new Map<string, number>();
  let whole: BookingRow | null = null;
  for (const booking of bookings) {
    if (!holdsTables(booking.status)) continue;
    if (booking.wholeHall && booking.hallId === areaId) whole = booking;
    for (const t of booking.floorTables) {
      held.set(t.floorTableId, booking);
      guests.set(t.floorTableId, t.guestCount);
    }
  }
  return { held, guests, whole };
}

/**
 * The bookings this sheet lists: the ones holding a table ON this area's map,
 * plus one taking the area whole. A booking in the room next door is on that
 * room's sheet, not this one.
 */
/** How full a reserved table is, which is what the sheet has to show. */
export type TableFill = 'free' | 'partly' | 'taken';

/**
 * Whether a table is free, part-filled or full.
 *
 * **A reserved table is not necessarily a full one**: a party of three at a
 * ten-top leaves seven seats that the restaurant can still sell, and a sheet
 * that draws it exactly like a full table hides that. A whole-area booking
 * counts as full — it has no per-table count, and the area is let as one.
 */
export function fillOf(
  table: { id: string; seats: number },
  held: Map<string, BookingRow>,
  guests: Map<string, number>,
  whole: BookingRow | null,
): TableFill {
  if (whole) return 'taken';
  if (!held.has(table.id)) return 'free';
  const seated = guests.get(table.id) ?? 0;
  return seated > 0 && seated < table.seats ? 'partly' : 'taken';
}

export function bookingsForArea(
  bookings: BookingRow[],
  areaId: string,
  tables: { id: string }[],
): BookingRow[] {
  const here = new Set(tables.map((x) => x.id));
  return bookings.filter((b) => holdsTables(b.status)
    && (b.wholeHall ? b.hallId === areaId : b.floorTables.some((t) => here.has(t.floorTableId))));
}

/**
 * The clock time a booking starts at, in the reader's own timezone.
 *
 * `toISOString()` prints UTC, and that is how a 19:00 banquet came out on the
 * sheet as 14:00: the restaurant is five hours ahead of the instant stored. The
 * offset is shifted in and the UTC fields are then read off, which needs no
 * timezone database and matches what `event.ledgerSync.ts` does.
 */
export function timeOf(date: Date | string, tzOffsetMinutes = 0): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + tzOffsetMinutes * 60_000).toISOString().slice(11, 16);
}

export function buildFloorPlanPdf(plan: PrintablePlan): PDFKit.PDFDocument {
  const s = { ...stringsFor(plan.lang), ...(plan.strings ?? {}) };
  const tz = plan.tzOffsetMinutes ?? 0;
  const at = (date: Date | string) => timeOf(date, tz);
  const doc = new PDFDocument({ size: A4_LANDSCAPE, margin: MARGIN });

  // Cyrillic. The built-in Helvetica is WinAnsi-encoded, so every Russian
  // letter in an area name, a customer's name or a zone label came out as
  // random glyphs. DejaVu is the same font the other exports here register, and
  // the same fallback applies: if it is missing, the sheet is still produced.
  let R = 'Helvetica';
  let B = 'Helvetica-Bold';
  try {
    doc.registerFont('R', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    doc.registerFont('B', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
    R = 'R';
    B = 'B';
  } catch { /* keep Helvetica */ }

  const { held, guests: guestsAt, whole: wholeAreaBooking } = heldTables(plan.bookings, plan.area.id);

  // ── Heading ──────────────────────────────────────────────────────────────
  doc.fillColor(INK).font(B).fontSize(18).text(plan.area.name, MARGIN, MARGIN);
  doc.font(R).fontSize(10).fillColor(MUTED)
    .text(`${plan.restaurantName ? `${plan.restaurantName} · ` : ''}${s.title} · ${plan.day}`,
      MARGIN, MARGIN + 24);
  if (wholeAreaBooking) {
    doc.font(B).fontSize(10).fillColor(INK)
      .text(`${s.wholeArea}: #${wholeAreaBooking.eventNumber} ${wholeAreaBooking.customerName}`,
        MARGIN, MARGIN + 40);
  }

  // ── The map ──────────────────────────────────────────────────────────────
  // The right third of the page carries the booking list, so the plan is
  // fitted to the left two thirds and centred in it.
  const top = MARGIN + (wholeAreaBooking ? 58 : 44);
  const listWidth = 240;
  const boxW = A4_LANDSCAPE[0] - MARGIN * 2 - listWidth - 16;
  const boxH = A4_LANDSCAPE[1] - top - MARGIN - 34;
  const room = areaSize(plan.area);
  const scale = Math.min(boxW / room.width, boxH / room.height);
  const offX = MARGIN + (boxW - room.width * scale) / 2;
  const offY = top + (boxH - room.height * scale) / 2;
  const X = (x: number) => offX + x * scale;
  const Y = (y: number) => offY + y * scale;

  doc.save().rect(MARGIN, top, boxW, boxH).clip();

  // The drawing under the tables.
  const features = Array.isArray(plan.area.mapFeatures) ? (plan.area.mapFeatures as MapFeature[]) : [];
  for (const f of features) {
    const fill = FEATURE_FILL[f.kind] ?? FEATURE_FILL.zone;
    if (fill !== 'none') {
      if (f.shape === 'rect') doc.rect(X(f.x), Y(f.y), f.width * scale, f.height * scale).fill(fill);
      else if (f.shape === 'ellipse') {
        doc.ellipse(X(f.x + f.width / 2), Y(f.y + f.height / 2), (f.width / 2) * scale, (f.height / 2) * scale).fill(fill);
      } else if (f.shape === 'polygon' && f.points.length > 2) {
        doc.moveTo(X(f.points[0][0]), Y(f.points[0][1]));
        for (const [px, py] of f.points.slice(1)) doc.lineTo(X(px), Y(py));
        doc.closePath().fill(fill);
      }
    }
    if (f.label) {
      const [lx, ly] = f.shape === 'polygon'
        ? [f.points.reduce((a, p) => a + p[0], 0) / f.points.length, f.points.reduce((a, p) => a + p[1], 0) / f.points.length]
        : f.shape === 'point' ? [f.x, f.y] : [f.x + f.width / 2, f.y + f.height / 2];
      doc.fillColor(MUTED).font(R).fontSize(7)
        .text(f.label, X(lx) - 50, Y(ly) - 4, { width: 100, align: 'center' });
    }
  }

  // The tables.
  for (const table of plan.tables) {
    const { width, height } = tableSize(table.shape, table.seats, table);
    const w = width * scale;
    const h = height * scale;
    const booking = held.get(table.id) ?? wholeAreaBooking;
    const state = fillOf(table, held, guestsAt, wholeAreaBooking);
    const fill = state === 'taken' ? TAKEN_FILL : state === 'partly' ? PARTLY_FILL : FREE_FILL;

    doc.save();
    doc.translate(X(table.x), Y(table.y)).rotate(table.rotation);
    if (table.shape === 'ROUND') doc.ellipse(0, 0, w / 2, h / 2);
    else doc.roundedRect(-w / 2, -h / 2, w, h, Math.min(3, w / 6));
    // A part-filled table is outlined heavier as well as filled. That began as
    // the only thing separating two greys; it is kept now that they are
    // colours, because it is also what survives the photocopy and what a
    // red/green reader has left when red and yellow converge.
    doc.lineWidth(state === 'partly' ? 1.6 : 0.7).fillAndStroke(fill, INK);
    doc.restore();
    doc.lineWidth(1);

    // The number is drawn UPRIGHT whatever the table's rotation — a label
    // turned 45° is a label nobody reads across a room.
    const size = Math.max(5, Math.min(11, Math.min(w, h) * 0.42));
    // White on the red, ink on the yellow and on the open table. White on
    // #ffd43b would be unreadable, which is what sets this apart per state
    // rather than one colour for every number.
    doc.fillColor(state === 'taken' ? '#ffffff' : INK).font(B).fontSize(size)
      .text(table.label, X(table.x) - 30, Y(table.y) - size * 0.75, { width: 60, align: 'center' });
    const seated = guestsAt.get(table.id);
    doc.font(R).fontSize(Math.max(4, size * 0.62)).fillColor(state === 'taken' ? '#f3f4f6' : MUTED)
      // Seated of capacity whenever a booking is on it, so a party of 3 at a
      // ten-top says so; free tables carry their capacity alone.
      .text(booking ? `${seated ?? table.seats}/${table.seats}` : String(table.seats),
        X(table.x) - 30, Y(table.y) + size * 0.35, { width: 60, align: 'center' });
  }
  doc.restore();

  // Map frame + legend. Three entries, because "reserved" and "reserved but
  // not full" are different answers to what a waiter is asking the sheet.
  doc.lineWidth(0.7).strokeColor(LINE).rect(MARGIN, top, boxW, boxH).stroke();
  doc.lineWidth(1);
  const legendY = top + boxH + 10;
  let lx = MARGIN;
  for (const [label, fill] of [[s.free, FREE_FILL], [s.partly, PARTLY_FILL], [s.taken, TAKEN_FILL]] as const) {
    doc.rect(lx, legendY, 12, 9).fillAndStroke(fill, INK);
    doc.fillColor(MUTED).font(R).fontSize(8).text(label, lx + 16, legendY + 1);
    lx += 22 + doc.widthOfString(label);
  }

  // ── The day's bookings ───────────────────────────────────────────────────
  const listX = MARGIN + boxW + 16;
  let y = top;
  doc.fillColor(INK).font(B).fontSize(11).text(s.bookings, listX, y, { width: listWidth });
  y += 18;

  const shown = bookingsForArea(plan.bookings, plan.area.id, plan.tables);
  // Bookings in this room that hold no table yet. They are on the sheet with
  // the rest — an evening the restaurant has sold does not become invisible
  // because nobody has said where it sits — under their own heading, since
  // there is no table on the plan to look for them at.
  const pending = unassignedBookings(plan.bookings, plan.area.id);

  if (shown.length === 0 && pending.length === 0) {
    doc.font(R).fontSize(9).fillColor(MUTED).text(s.noBookings, listX, y, { width: listWidth });
  }
  const labelOf = new Map(plan.tables.map((t) => [t.id, t.label]));
  const seatsOf = new Map(plan.tables.map((t) => [t.id, t.seats]));

  /** One booking's two lines, wrapping onto a second page when it must. */
  const row = (booking: BookingRow, second: string) => {
    // Runs off the page rather than silently dropping the rest: a sheet that
    // stops at the eleventh booking with no sign is worse than a second page.
    if (y > A4_LANDSCAPE[1] - MARGIN - 40) {
      doc.addPage({ size: A4_LANDSCAPE, margin: MARGIN });
      y = MARGIN;
    }
    doc.fillColor(INK).font(B).fontSize(9)
      .text(`${at(booking.eventDate)}  #${booking.eventNumber}  ${booking.customerName}`, listX, y, { width: listWidth });
    y = doc.y + 1;
    doc.font(R).fontSize(8).fillColor(MUTED).text(second, listX, y, { width: listWidth });
    y = doc.y + 7;
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(listX, y - 3).lineTo(listX + listWidth, y - 3).stroke();
    doc.lineWidth(1);
  };

  for (const booking of shown) {
    const tables = booking.wholeHall
      ? s.wholeArea
      : booking.floorTables
        .map((t) => labelOf.get(t.floorTableId))
        .filter(Boolean)
        .map((l) => `${s.table} ${l}`)
        .join(', ');
    // How many seats this party leaves unsold at the tables it holds. Said on
    // the line rather than left to be worked out from the plan: it is what
    // decides whether the room can still take somebody else.
    const free = booking.wholeHall ? 0 : booking.floorTables.reduce(
      (sum, t) => sum + Math.max(0, (seatsOf.get(t.floorTableId) ?? 0) - t.guestCount), 0,
    );
    row(booking, [
      tables,
      `${booking.guestCount} ${s.guests}`,
      ...(free > 0 ? [`${free} ${s.seatsFree}`] : []),
      ...(booking.customerPhone ? [booking.customerPhone] : []),
    ].join(' · '));
  }

  if (pending.length > 0) {
    if (y > A4_LANDSCAPE[1] - MARGIN - 60) {
      doc.addPage({ size: A4_LANDSCAPE, margin: MARGIN });
      y = MARGIN;
    }
    y += 6;
    doc.fillColor(INK).font(B).fontSize(10).text(s.noTables, listX, y, { width: listWidth });
    y = doc.y + 6;
    for (const booking of pending) {
      row(booking, [
        `${booking.guestCount} ${s.guests}`,
        ...(booking.customerPhone ? [booking.customerPhone] : []),
      ].join(' · '));
    }
  }

  return doc;
}
