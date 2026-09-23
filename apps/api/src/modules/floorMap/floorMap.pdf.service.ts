import PDFDocument from 'pdfkit';
import { areaSize, tableSize } from '../../utils/floorGeometry.js';
import { holdsTables, type BookingRow } from '../../utils/floorBooking.js';
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

type Strings = {
  title: string;
  free: string;
  taken: string;
  wholeArea: string;
  bookings: string;
  noBookings: string;
  guests: string;
  table: string;
};

const EN: Strings = {
  title: 'Floor plan',
  free: 'Free',
  taken: 'Reserved',
  wholeArea: 'Whole area reserved',
  bookings: 'Bookings on this day',
  noBookings: 'No bookings on this day.',
  guests: 'guests',
  table: 'Table',
};

export type PrintablePlan = {
  area: AreaRow;
  tables: TableRow[];
  bookings: BookingRow[];
  day: string;
  restaurantName?: string | null;
  strings?: Partial<Strings>;
};

const INK = '#111827';
const MUTED = '#6b7280';
const LINE = '#d1d5db';
/** A taken table is filled; free is left open. Survives a mono photocopy. */
const TAKEN_FILL = '#9ca3af';
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
export function bookingsForArea(
  bookings: BookingRow[],
  areaId: string,
  tables: { id: string }[],
): BookingRow[] {
  const here = new Set(tables.map((x) => x.id));
  return bookings.filter((b) => holdsTables(b.status)
    && (b.wholeHall ? b.hallId === areaId : b.floorTables.some((t) => here.has(t.floorTableId))));
}

const timeOf = (date: Date | string) => {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(11, 16);
};

export function buildFloorPlanPdf(plan: PrintablePlan): PDFKit.PDFDocument {
  const s = { ...EN, ...(plan.strings ?? {}) };
  const doc = new PDFDocument({ size: A4_LANDSCAPE, margin: MARGIN });

  const { held, guests: guestsAt, whole: wholeAreaBooking } = heldTables(plan.bookings, plan.area.id);

  // ── Heading ──────────────────────────────────────────────────────────────
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(plan.area.name, MARGIN, MARGIN);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text(`${plan.restaurantName ? `${plan.restaurantName} · ` : ''}${s.title} · ${plan.day}`,
      MARGIN, MARGIN + 24);
  if (wholeAreaBooking) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK)
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
      doc.fillColor(MUTED).font('Helvetica').fontSize(7)
        .text(f.label, X(lx) - 50, Y(ly) - 4, { width: 100, align: 'center' });
    }
  }

  // The tables.
  for (const table of plan.tables) {
    const { width, height } = tableSize(table.shape, table.seats, table);
    const w = width * scale;
    const h = height * scale;
    const booking = held.get(table.id) ?? wholeAreaBooking;
    const fill = booking ? TAKEN_FILL : FREE_FILL;

    doc.save();
    doc.translate(X(table.x), Y(table.y)).rotate(table.rotation);
    if (table.shape === 'ROUND') doc.ellipse(0, 0, w / 2, h / 2);
    else doc.roundedRect(-w / 2, -h / 2, w, h, Math.min(3, w / 6));
    doc.fillAndStroke(fill, INK);
    doc.restore();

    // The number is drawn UPRIGHT whatever the table's rotation — a label
    // turned 45° is a label nobody reads across a room.
    const size = Math.max(5, Math.min(11, Math.min(w, h) * 0.42));
    doc.fillColor(booking ? '#ffffff' : INK).font('Helvetica-Bold').fontSize(size)
      .text(table.label, X(table.x) - 30, Y(table.y) - size * 0.75, { width: 60, align: 'center' });
    const seated = guestsAt.get(table.id);
    doc.font('Helvetica').fontSize(Math.max(4, size * 0.62)).fillColor(booking ? '#f3f4f6' : MUTED)
      .text(seated ? `${seated}/${table.seats}` : String(table.seats),
        X(table.x) - 30, Y(table.y) + size * 0.35, { width: 60, align: 'center' });
  }
  doc.restore();

  // Map frame + legend.
  doc.lineWidth(0.7).strokeColor(LINE).rect(MARGIN, top, boxW, boxH).stroke();
  const legendY = top + boxH + 10;
  let lx = MARGIN;
  for (const [label, fill] of [[s.free, FREE_FILL], [s.taken, TAKEN_FILL]] as const) {
    doc.rect(lx, legendY, 12, 9).fillAndStroke(fill, INK);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(label, lx + 16, legendY + 1);
    lx += 22 + doc.widthOfString(label);
  }

  // ── The day's bookings ───────────────────────────────────────────────────
  const listX = MARGIN + boxW + 16;
  let y = top;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(s.bookings, listX, y, { width: listWidth });
  y += 18;

  const shown = bookingsForArea(plan.bookings, plan.area.id, plan.tables);

  if (shown.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(s.noBookings, listX, y, { width: listWidth });
  }
  const labelOf = new Map(plan.tables.map((t) => [t.id, t.label]));
  for (const booking of shown) {
    // Runs off the page rather than silently dropping the rest: a sheet that
    // stops at the eleventh booking with no sign is worse than a second page.
    if (y > A4_LANDSCAPE[1] - MARGIN - 40) {
      doc.addPage({ size: A4_LANDSCAPE, margin: MARGIN });
      y = MARGIN;
    }
    const tables = booking.wholeHall
      ? s.wholeArea
      : booking.floorTables
        .map((t) => labelOf.get(t.floorTableId))
        .filter(Boolean)
        .map((l) => `${s.table} ${l}`)
        .join(', ');
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9)
      .text(`${timeOf(booking.eventDate)}  #${booking.eventNumber}  ${booking.customerName}`, listX, y, { width: listWidth });
    y = doc.y + 1;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`${tables} · ${booking.guestCount} ${s.guests}${booking.customerPhone ? ` · ${booking.customerPhone}` : ''}`,
        listX, y, { width: listWidth });
    y = doc.y + 7;
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(listX, y - 3).lineTo(listX + listWidth, y - 3).stroke();
  }

  return doc;
}
