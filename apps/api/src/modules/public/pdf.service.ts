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
  pricing: {
    perGuestCents: number;
    originalPerGuestCents?: number;
    totalCents?: number;
    originalTotalCents?: number;
    discountPercent?: number;
    hasDiscount?: boolean;
  };
  locale: Locale;
  restaurantName?: string;
  restaurantLogoUrl?: string | null;
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

export async function loadLogoBuffer(
  restaurantLogoUrl: string | null | undefined,
  uploadsDir: string,
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
  const candidates = [
    path.resolve(uploadsDir, '..', 'src', 'assets', 'logo.png'),
    path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo.png'),
  ];
  for (const c of candidates) {
    try { return fs.readFileSync(c); } catch { /* try next */ }
  }
  return null;
}

export async function generateSummaryPdf(data: SummaryData): Promise<Buffer> {
  const logoImage = await loadLogoBuffer(data.restaurantLogoUrl, UPLOADS_DIR);
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

    // Draw a table header row (two columns with labels)
    const tableHeader = (x: number, y: number, label1: string, label2: string) => {
      cell(x, y, COL1, HEADER_H, label1, { bold: true, fontSize: 9, fillColor: '#f0f0f0', align: 'center' });
      cell(x + COL1, y, COL2, HEADER_H, label2, { bold: true, fontSize: 9, fillColor: '#f0f0f0', align: 'center' });
      return y + HEADER_H;
    };

    // Draw a section sub-header spanning both columns
    const sectionRow = (x: number, y: number, label: string) => {
      ensureSpace(SECTION_H);
      cell(x, y, TW, SECTION_H, label, { bold: true, fontSize: 9, align: 'center', fillColor: '#e8e8e8' });
      return y + SECTION_H;
    };

    // Draw a data row
    const dataRow = (x: number, y: number, name: string, qty: string, shade = false) => {
      ensureSpace(ROW_H);
      cell(x, y, COL1, ROW_H, name, { fontSize: 9, fillColor: shade ? '#fafafa' : '#ffffff' });
      cell(x + COL1, y, COL2, ROW_H, qty, { fontSize: 9, align: 'center', fillColor: shade ? '#fafafa' : '#ffffff' });
      return y + ROW_H;
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

    const today = new Date().toLocaleDateString(
      data.locale === 'ru' ? 'ru-RU' : data.locale === 'uz' ? 'uz-UZ' : 'en-GB',
      { day: '2-digit', month: '2-digit', year: '2-digit' }
    );

    const infoRows = [
      [t('hall') + ':', data.hallName, t('date') + ':', today],
      [t('name') + ':', data.customerName, t('phone') + ':', data.customerPhone],
      [t('table_category') + ':', data.tableCategoryName, t('guest_count') + ':', String(data.guestCount)],
    ];

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

    // ── Main table ────────────────────────────────────────────────────────

    curY = tableHeader(ML, curY, t('dish_name'), t('qty_pcs'));

    // Group included dishes by category
    const includedDishes = data.includedDishes ?? [];
    type Block = { label: string; dishes: typeof includedDishes };
    const blocks: Block[] = [];
    const blockByCat = new Map<string, Block>();
    for (const dish of includedDishes) {
      let block = blockByCat.get(dish.category);
      if (!block) {
        block = { label: dish.categoryLabel || dish.category, dishes: [] };
        blockByCat.set(dish.category, block);
        blocks.push(block);
      }
      block.dishes.push(dish);
    }

    // Render included dish blocks
    let shade = false;
    if (blocks.length > 0) {
      for (const block of blocks) {
        curY = sectionRow(ML, curY, block.label.toUpperCase());
        for (const dish of block.dishes) {
          const servings = dish.servings ?? 1;
          curY = dataRow(ML, curY, dish.name, String(servings), shade);
          shade = !shade;
        }
      }
    }

    // Additional paid items
    const selectedMenuItems = data.menuItems.filter((item) => data.selectedItems[item.id] > 0);
    if (selectedMenuItems.length > 0) {
      // Group by category label
      type AdditionalBlock = { label: string; items: typeof selectedMenuItems };
      const addBlocks: AdditionalBlock[] = [];
      const addByCat = new Map<string, AdditionalBlock>();
      for (const item of selectedMenuItems) {
        let block = addByCat.get(item.category);
        if (!block) {
          // Use the translated category key from the category enum
          const catKey = item.category.toLowerCase() as Parameters<typeof translate>[0];
          let catLabel = item.category;
          try { catLabel = translate(catKey, data.locale); } catch { /* keep enum */ }
          block = { label: catLabel, items: [] };
          addByCat.set(item.category, block);
          addBlocks.push(block);
        }
        block.items.push(item);
      }
      for (const block of addBlocks) {
        curY = sectionRow(ML, curY, block.label.toUpperCase());
        for (const item of block.items) {
          const qty = data.selectedItems[item.id];
          curY = dataRow(ML, curY, item.name, String(qty), shade);
          shade = !shade;
        }
      }
    }

    // ── Children's table section (optional add-on) ────────────────────────
    const childrenDishes = data.childrenDishes ?? [];
    if (data.childrenTableName && (childrenDishes.length > 0 || (data.childrenCount ?? 0) > 0)) {
      const heading = `${t('children_table')} — ${data.childrenTableName}` +
        ((data.childrenCount ?? 0) > 0 ? ` (${t('children_count')}: ${data.childrenCount})` : '');
      curY = sectionRow(ML, curY, heading.toUpperCase());
      // Group children's dishes by category label.
      type CBlock = { label: string; dishes: typeof childrenDishes };
      const cBlocks: CBlock[] = [];
      const cByCat = new Map<string, CBlock>();
      for (const dish of childrenDishes) {
        let block = cByCat.get(dish.category);
        if (!block) {
          block = { label: dish.categoryLabel || dish.category, dishes: [] };
          cByCat.set(dish.category, block);
          cBlocks.push(block);
        }
        block.dishes.push(dish);
      }
      for (const block of cBlocks) {
        curY = sectionRow(ML, curY, block.label.toUpperCase());
        for (const dish of block.dishes) {
          curY = dataRow(ML, curY, dish.name, String(dish.servings ?? 1), shade);
          shade = !shade;
        }
      }
    }

    // ── Pricing rows at the bottom of the table ───────────────────────────
    const hasDiscount = !!data.pricing.hasDiscount && (data.pricing.discountPercent ?? 0) > 0;
    const totalCents = data.pricing.totalCents ?? data.pricing.perGuestCents;

    ensureSpace(SECTION_H + ROW_H * 3 + 20);

    curY = sectionRow(ML, curY, t('pricing').toUpperCase());

    if (hasDiscount && data.pricing.originalPerGuestCents != null) {
      curY = dataRow(ML, curY, `${t('price_per_guest')} (${t('original_price')})`, formatSom(data.pricing.originalPerGuestCents), false);
    }
    curY = dataRow(ML, curY, t('price_per_guest'), formatSom(data.pricing.perGuestCents), true);
    if (hasDiscount) {
      curY = dataRow(ML, curY, t('discount'), `−${data.pricing.discountPercent}%`, false);
    }
    if (data.childrenTableName && (data.childrenSubtotalCents ?? 0) > 0) {
      const per = data.childrenRateCents != null ? ` (${data.childrenCount} × ${formatSom(data.childrenRateCents)})` : '';
      curY = dataRow(ML, curY, `${t('children_table')}${per}`, formatSom(data.childrenSubtotalCents ?? 0), false);
    }
    if (hasDiscount && data.pricing.originalTotalCents != null) {
      curY = dataRow(ML, curY, `${t('total')} (${t('original_price')})`, formatSom(data.pricing.originalTotalCents), false);
    }
    // Total row — bold, slightly taller
    ensureSpace(ROW_H + 4);
    cell(ML, curY, COL1, ROW_H + 4, t('total'), { bold: true, fontSize: 10, fillColor: '#f0f0f0' });
    cell(ML + COL1, curY, COL2, ROW_H + 4, formatSom(totalCents), { bold: true, fontSize: 10, align: 'center', fillColor: '#f0f0f0' });
    curY += ROW_H + 4;

    // ── Footer note ───────────────────────────────────────────────────────
    curY += 14;
    ensureSpace(30);
    doc.font(R, 8).fillColor('#555')
      .text(t('thank_you_message'), ML, curY, { width: TW, align: 'center' });

    doc.end();
  });
}
