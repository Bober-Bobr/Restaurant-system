import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translate, type Locale } from '../../utils/translate.js';
import { formatSom } from '../../utils/currency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, '..', '..', '..', 'uploads');

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  priceCents: number;
}

interface SummaryData {
  customerName: string;
  customerPhone: string;
  secondCustomerName?: string;
  secondCustomerPhone?: string;
  // ISO date string of the event itself. When present the PDF shows this as the
  // event date instead of the download date.
  eventDate?: string;
  hallName: string;
  tableCategoryName: string;
  guestCount: number;
  selectedItems: { [itemId: string]: number };
  menuItems: MenuItem[];
  includedDishes?: { name: string; category: string; categoryLabel?: string; servings?: number }[];
  // Optional children's table add-on.
  childrenTableName?: string;
  childrenCount?: number;
  childrenRateCents?: number;
  childrenSubtotalCents?: number;
  childrenDishes?: { name: string; category: string; categoryLabel?: string; servings?: number }[];
  // Additional paid restaurant services the guest selected on the Summary page.
  extraServices?: { name: string; description?: string | null; priceCents: number }[];
  pricing: {
    perGuestCents: number;
    originalPerGuestCents?: number;
    totalCents?: number;
    originalTotalCents?: number;
    discountPercent?: number;
    hasDiscount?: boolean;
    // Prepaid deposit subtracted from the total, and the resulting amount due.
    depositCents?: number;
    amountDueCents?: number;
  };
  locale: Locale;
  restaurantName?: string;
  restaurantLogoUrl?: string | null;
}

/**
 * The four categories that are carried out to the table during the banquet, in
 * the order they are served. They go in a table of their own at the top of the
 * document: the kitchen reads that table on the night, and it used to be
 * scattered through the whole list — hot appetizers at the front, the three
 * courses at the very bottom, with every salad and pastry in between.
 *
 * `SECOND_COURSE` is the main course. The enum is named for the order it is
 * served in, not for what it is.
 */
export const SERVED_CATEGORIES = ['HOT_APPETIZERS', 'FIRST_COURSE', 'SECOND_COURSE', 'THIRD_COURSE'] as const;
export type ServedCategory = (typeof SERVED_CATEGORIES)[number];

export const isServedCategory = (category: string): category is ServedCategory =>
  (SERVED_CATEGORIES as readonly string[]).includes(category);

/**
 * How many portions of an included dish to write in the quantity column.
 *
 * A hot appetizer is one per guest — it is the only included dish that is, and
 * the package item's `servings` is not the head count, so a banquet for 200 was
 * asking the kitchen for a single portion. Every other included dish keeps the
 * servings the package declares: a salad shared by a table of ten is one bowl,
 * not ten.
 *
 * `guests` is the head count the row belongs to, so the children's table passes
 * its own count rather than the adults'.
 */
export function servedPortions(
  dish: { category: string; servings?: number },
  guests: number,
): number {
  if (dish.category === 'HOT_APPETIZERS') return Math.max(guests, 0);
  return dish.servings ?? 1;
}

type DishRow = { name: string; category: string; categoryLabel?: string; servings?: number };
type MenuRow = { name: string; category: string; qty: string };
type CategoryBlock = { category: string; label: string; rows: MenuRow[] };

/**
 * Included dishes and the paid Additional dishes, grouped into ONE block per
 * category.
 *
 * They used to be two separate passes, so a category with both — salads that
 * come with the package and a salad the guest paid to add — was printed twice,
 * under the same heading, in two different halves of the document. Whoever
 * plates the salads reads one heading and gets one list.
 *
 * Included dishes come first inside a block and the paid ones follow, so the
 * order within a category is still "what the package gives you, then what was
 * added". First-seen order decides the blocks themselves; a category with only
 * paid dishes gets its block where it first appears.
 */
export function groupDishesByCategory(
  included: DishRow[],
  additional: { name: string; category: string; qty: number }[],
  guests: number,
  labelFor: (category: string) => string,
): CategoryBlock[] {
  const blocks: CategoryBlock[] = [];
  const byCategory = new Map<string, CategoryBlock>();
  const blockFor = (category: string, label: string) => {
    let block = byCategory.get(category);
    if (!block) {
      block = { category, label, rows: [] };
      byCategory.set(category, block);
      blocks.push(block);
    }
    return block;
  };

  for (const dish of included) {
    // The client sends a translated label; falling back to the server's own
    // translation rather than to the raw enum means a caller that omits it gets
    // "Горячие закуски" and not "HOT_APPETIZERS" — which is also what the paid
    // dishes in the same block have always shown.
    blockFor(dish.category, dish.categoryLabel || labelFor(dish.category)).rows.push({
      name: dish.name,
      category: dish.category,
      qty: String(servedPortions(dish, guests)),
    });
  }
  for (const item of additional) {
    blockFor(item.category, labelFor(item.category)).rows.push({
      name: item.name,
      category: item.category,
      qty: String(item.qty),
    });
  }
  return blocks;
}

/**
 * Split the blocks into the two tables: what is served during the evening, in
 * serving order, and everything else in the order it was built.
 */
export function splitServedBlocks(blocks: CategoryBlock[]): { served: CategoryBlock[]; rest: CategoryBlock[] } {
  const served = SERVED_CATEGORIES
    .map((category) => blocks.find((b) => b.category === category))
    .filter((b): b is CategoryBlock => !!b && b.rows.length > 0);
  const rest = blocks.filter((b) => !isServedCategory(b.category) && b.rows.length > 0);
  return { served, rest };
}

function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/uploads/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const relative = url.slice(idx + marker.length);
  if (relative.includes('..')) return null;
  const full = path.join(UPLOADS_DIR, relative);
  if (!full.startsWith(UPLOADS_DIR)) return null;
  return full;
}

/**
 * The restaurant's OWN logo, or nothing. `uploadsDir` used to be a second
 * parameter, needed only to locate the bundled fallback that no longer exists.
 */
export async function loadLogoBuffer(
  restaurantLogoUrl: string | null | undefined,
): Promise<Buffer | null> {
  const localPath = resolveUploadPath(restaurantLogoUrl);
  if (localPath) {
    try { return fs.readFileSync(localPath); } catch { /* fall through */ }
  }
  if (restaurantLogoUrl && /^https?:\/\//i.test(restaurantLogoUrl)) {
    try {
      const res = await fetch(restaurantLogoUrl);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch { /* fall through */ }
  }
  // No fallback image, deliberately. There used to be a bundled
  // `src/assets/logo.png` here, and it was ONE RESTAURANT'S logo — so every
  // tenant whose own logo was missing or unresolvable had a competitor's brand
  // stamped on their invoice. A document with no logo is merely plain; a
  // document with the wrong company's logo is wrong.
  return null;
}

export async function generateSummaryPdf(data: SummaryData): Promise<Buffer> {
  const logoImage = await loadLogoBuffer(data.restaurantLogoUrl);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Register Cyrillic-capable fonts
    let R = 'Helvetica';
    let B = 'Helvetica-Bold';
    try {
      doc.registerFont('R', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
      doc.registerFont('B', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
      R = 'R'; B = 'B';
    } catch { /* keep Helvetica */ }

    const t = (key: Parameters<typeof translate>[0]) => translate(key, data.locale);

    const ML = 40;  // margin left
    const MR = 40;  // margin right
    const PW = doc.page.width;
    const PH = doc.page.height;
    const TW = PW - ML - MR; // total content width

    // Table column widths
    const COL1 = TW * 0.78;
    const COL2 = TW * 0.22;
    const ROW_H = 18;
    const SECTION_H = 20;
    const HEADER_H = 22;

    let curY = ML;

    // ── Table drawing helpers ─────────────────────────────────────────────

    // Check if we need a new page (with some bottom margin)
    const ensureSpace = (needed: number) => {
      if (curY + needed > PH - 50) {
        doc.addPage();
        curY = ML;
      }
    };

    // Draw a single bordered cell
    const cell = (x: number, y: number, w: number, h: number, text: string, opts: {
      font?: string; fontSize?: number; align?: 'left' | 'center' | 'right';
      bold?: boolean; fillColor?: string; textColor?: string; paddingLeft?: number;
      border?: boolean;
    } = {}) => {
      const {
        font, fontSize = 9, align = 'left',
        fillColor = '#ffffff', textColor = '#000000',
        paddingLeft = 4, border = true,
      } = opts;
      doc.save();
      doc.rect(x, y, w, h).fillColor(fillColor).fill();
      if (border) {
        doc.rect(x, y, w, h).lineWidth(0.5).strokeColor('#000000').stroke();
      }
      const f = font ?? (opts.bold ? B : R);
      doc.fillColor(textColor).font(f, fontSize)
        .text(text, x + paddingLeft, y + (h - fontSize * 1.1) / 2 + 1, {
          width: w - paddingLeft * 2, align, lineBreak: false, ellipsis: true,
        });
      doc.restore();
    };

    // All table-drawing helpers read and update curY directly via closure so that
    // ensureSpace()'s page-break logic (which resets curY to ML) is always applied
    // before the cell is drawn. Passing y as a parameter would let the stale value
    // override the freshly-reset curY, placing every subsequent row on its own page.

    const tableHeader = (label1: string, label2: string) => {
      cell(ML, curY, COL1, HEADER_H, label1, { bold: true, fontSize: 9, fillColor: '#f0f0f0', align: 'center' });
      cell(ML + COL1, curY, COL2, HEADER_H, label2, { bold: true, fontSize: 9, fillColor: '#f0f0f0', align: 'center' });
      curY += HEADER_H;
    };

    const sectionRow = (label: string) => {
      ensureSpace(SECTION_H);
      cell(ML, curY, TW, SECTION_H, label, { bold: true, fontSize: 9, align: 'center', fillColor: '#e8e8e8' });
      curY += SECTION_H;
    };

    const dataRow = (name: string, qty: string, shade = false) => {
      ensureSpace(ROW_H);
      cell(ML, curY, COL1, ROW_H, name, { fontSize: 9, fillColor: shade ? '#fafafa' : '#ffffff' });
      cell(ML + COL1, curY, COL2, ROW_H, qty, { fontSize: 9, align: 'center', fillColor: shade ? '#fafafa' : '#ffffff' });
      curY += ROW_H;
    };

    // ── Page top: logo + restaurant name + document title ─────────────────

    if (logoImage) {
      try {
        doc.image(logoImage, ML, curY, { fit: [50, 50] });
      } catch { /* ignore */ }
    }

    const titleX = logoImage ? ML + 58 : ML;
    const titleW = logoImage ? TW - 58 : TW;

    doc.font(B, 14).fillColor('#000000')
      .text(data.restaurantName || 'Restaurant', titleX, curY + 4, { width: titleW, align: 'center' });
    doc.font(B, 12).fillColor('#000000')
      .text(t('menu_for_banquet'), titleX, curY + 22, { width: titleW, align: 'center' });

    curY = Math.max(curY + 55, (logoImage ? curY + 58 : curY + 40));

    // ── Info block (two-column label/value grid) ──────────────────────────

    const localeTag = data.locale === 'ru' ? 'ru-RU' : data.locale === 'uz' ? 'uz-UZ' : 'en-GB';
    // The event date (the banquet date) — not the day the file was downloaded.
    const eventDateStr = (data.eventDate ? new Date(data.eventDate) : new Date())
      .toLocaleDateString(localeTag, { day: '2-digit', month: '2-digit', year: '2-digit' });

    const infoRows: [string, string, string, string][] = [
      [t('hall') + ':', data.hallName, t('date') + ':', eventDateStr],
      [t('name') + ':', data.customerName, t('phone') + ':', data.customerPhone],
    ];
    // Optional second contact person.
    if (data.secondCustomerName || data.secondCustomerPhone) {
      infoRows.push([t('name') + ':', data.secondCustomerName ?? '', t('phone') + ':', data.secondCustomerPhone ?? '']);
    }
    infoRows.push([t('table_category') + ':', data.tableCategoryName, t('guest_count') + ':', String(data.guestCount)]);

    const halfW = TW / 2 - 4;
    for (const [lbl1, val1, lbl2, val2] of infoRows) {
      ensureSpace(16);
      doc.font(B, 8).fillColor('#555').text(lbl1!, ML, curY + 1, { width: 70, lineBreak: false });
      doc.font(R, 9).fillColor('#000').text(val1!, ML + 72, curY + 1, { width: halfW - 72, lineBreak: false });
      doc.font(B, 8).fillColor('#555').text(lbl2!, ML + halfW + 8, curY + 1, { width: 60, lineBreak: false });
      doc.font(R, 9).fillColor('#000').text(val2!, ML + halfW + 70, curY + 1, { width: halfW - 70, lineBreak: false });
      curY += 14;
    }

    curY += 8;

    // ── The dishes ────────────────────────────────────────────────────────
    //
    // Two tables. The first is what is carried out during the evening — hot
    // appetizers, then the first, main and third courses — because that is the
    // list the kitchen works from on the night, and it used to be split across
    // the top and the bottom of one long table with the whole cold table in
    // between. Everything else follows in the second.
    //
    // In both, the paid Additional dishes sit inside the category block they
    // belong to rather than in a second run of the same headings.

    const labelFor = (category: string) => {
      const key = category.toLowerCase() as Parameters<typeof translate>[0];
      try { return translate(key, data.locale); } catch { return category; }
    };

    const selectedMenuItems = data.menuItems.filter((item) => data.selectedItems[item.id]! > 0);
    const { served, rest } = splitServedBlocks(groupDishesByCategory(
      data.includedDishes ?? [],
      selectedMenuItems.map((item) => ({
        name: item.name,
        category: item.category,
        qty: data.selectedItems[item.id]!,
      })),
      data.guestCount,
      labelFor,
    ));

    let shade = false;
    const renderBlocks = (caption: string | null, blocks: CategoryBlock[]) => {
      if (blocks.length === 0) return;
      // A caption plus its header and first section, kept together: a table that
      // starts with its heading alone at the foot of a page is unreadable.
      ensureSpace((caption ? SECTION_H : 0) + HEADER_H + SECTION_H + ROW_H);
      if (caption) sectionRow(caption);
      tableHeader(t('dish_name'), t('qty_pcs'));
      for (const block of blocks) {
        sectionRow(block.label.toUpperCase());
        for (const row of block.rows) {
          dataRow(row.name, row.qty, shade);
          shade = !shade;
        }
      }
    };

    renderBlocks(served.length > 0 ? t('served_dishes') : null, served);
    if (served.length > 0 && rest.length > 0) curY += 10;
    renderBlocks(served.length > 0 ? t('other_dishes') : null, rest);
    // Neither table exists on an empty booking, and the pricing below still
    // needs a header to sit under.
    if (served.length === 0 && rest.length === 0) tableHeader(t('dish_name'), t('qty_pcs'));

    // ── Children's table section (optional add-on) ────────────────────────
    const childrenDishes = data.childrenDishes ?? [];
    if (data.childrenTableName && (childrenDishes.length > 0 || (data.childrenCount ?? 0) > 0)) {
      const heading = `${t('children_table')} — ${data.childrenTableName}` +
        ((data.childrenCount ?? 0) > 0 ? ` (${t('children_count')}: ${data.childrenCount})` : '');
      sectionRow(heading.toUpperCase());
      // Its own add-on section, so it keeps its place rather than being folded
      // into the two tables above — but the same two rules apply inside it: the
      // served courses lead, and a hot appetizer is one per CHILD, counted from
      // the children's own head count and not the adults'.
      const childBlocks = groupDishesByCategory(childrenDishes, [], data.childrenCount ?? 0, labelFor);
      const childSplit = splitServedBlocks(childBlocks);
      for (const block of [...childSplit.served, ...childSplit.rest]) {
        sectionRow(block.label.toUpperCase());
        for (const row of block.rows) {
          dataRow(row.name, row.qty, shade);
          shade = !shade;
        }
      }
    }

    // ── Additional restaurant services (name → price, not a quantity) ─────
    const extraServices = data.extraServices ?? [];
    if (extraServices.length > 0) {
      sectionRow(t('extra_services').toUpperCase());
      for (const service of extraServices) {
        const label = service.description ? `${service.name} — ${service.description}` : service.name;
        dataRow(label, formatSom(service.priceCents), shade);
        shade = !shade;
      }
    }

    // ── Pricing rows at the bottom of the table ───────────────────────────
    const hasDiscount = !!data.pricing.hasDiscount && (data.pricing.discountPercent ?? 0) > 0;
    const totalCents = data.pricing.totalCents ?? data.pricing.perGuestCents;

    ensureSpace(SECTION_H + ROW_H * 3 + 20);

    sectionRow(t('pricing').toUpperCase());

    if (hasDiscount && data.pricing.originalPerGuestCents != null) {
      dataRow(`${t('price_per_guest')} (${t('original_price')})`, formatSom(data.pricing.originalPerGuestCents), false);
    }
    dataRow(t('price_per_guest'), formatSom(data.pricing.perGuestCents), true);
    if (hasDiscount) {
      dataRow(t('discount'), `−${data.pricing.discountPercent}%`, false);
    }
    if (data.childrenTableName && (data.childrenSubtotalCents ?? 0) > 0) {
      const per = data.childrenRateCents != null ? ` (${data.childrenCount} × ${formatSom(data.childrenRateCents)})` : '';
      dataRow(`${t('children_table')}${per}`, formatSom(data.childrenSubtotalCents ?? 0), false);
    }
    const servicesTotalCents = extraServices.reduce((sum, sv) => sum + sv.priceCents, 0);
    if (servicesTotalCents > 0) {
      dataRow(t('extra_services'), formatSom(servicesTotalCents), false);
    }
    if (hasDiscount && data.pricing.originalTotalCents != null) {
      dataRow(`${t('total')} (${t('original_price')})`, formatSom(data.pricing.originalTotalCents), false);
    }
    // Total row — bold, slightly taller
    ensureSpace(ROW_H + 4);
    cell(ML, curY, COL1, ROW_H + 4, t('total'), { bold: true, fontSize: 10, fillColor: '#f0f0f0' });
    cell(ML + COL1, curY, COL2, ROW_H + 4, formatSom(totalCents), { bold: true, fontSize: 10, align: 'center', fillColor: '#f0f0f0' });
    curY += ROW_H + 4;

    // ── Deposit + amount due (only when a deposit was entered) ─────────────
    const depositCents = data.pricing.depositCents ?? 0;
    if (depositCents > 0) {
      dataRow(t('deposit'), `−${formatSom(depositCents)}`, false);
      const amountDueCents = data.pricing.amountDueCents ?? Math.max(0, totalCents - depositCents);
      ensureSpace(ROW_H + 4);
      cell(ML, curY, COL1, ROW_H + 4, t('amount_due'), { bold: true, fontSize: 10, fillColor: '#f0f0f0' });
      cell(ML + COL1, curY, COL2, ROW_H + 4, formatSom(amountDueCents), { bold: true, fontSize: 10, align: 'center', fillColor: '#f0f0f0' });
      curY += ROW_H + 4;
    }

    // ── Footer note ───────────────────────────────────────────────────────
    curY += 14;
    ensureSpace(30);
    doc.font(R, 8).fillColor('#555')
      .text(t('thank_you_message'), ML, curY, { width: TW, align: 'center' });

    doc.end();
  });
}
