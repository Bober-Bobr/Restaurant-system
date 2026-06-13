import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translate, type Locale } from '../../utils/translate.js';
import { formatSom } from '../../utils/currency.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When compiled: dist/modules/public/ → three levels up → apps/api/
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

// Resolve a "/uploads/..." URL to an on-disk path, guarding against traversal.
function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/uploads/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null; // external URL or unrecognised — caller falls back
  const relative = url.slice(idx + marker.length);
  if (relative.includes('..')) return null;
  const full = path.join(UPLOADS_DIR, relative);
  if (!full.startsWith(UPLOADS_DIR)) return null;
  return full;
}

// Load the logo buffer: restaurant upload (local file) → remote URL → system logo.
export async function loadLogoBuffer(
  restaurantLogoUrl: string | null | undefined,
  uploadsDir: string,
): Promise<Buffer | null> {
  // 1. Local uploaded file
  const localPath = resolveUploadPath(restaurantLogoUrl);
  if (localPath) {
    try { return fs.readFileSync(localPath); } catch { /* fall through */ }
  }
  // 2. Remote http(s) URL
  if (restaurantLogoUrl && /^https?:\/\//i.test(restaurantLogoUrl)) {
    try {
      const res = await fetch(restaurantLogoUrl);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }
    } catch { /* fall through */ }
  }
  // 3. Bundled system logo (try dist-relative then cwd-relative)
  const candidates = [
    path.resolve(uploadsDir, '..', 'src', 'assets', 'logo.png'),
    path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo.png'),
  ];
  for (const c of candidates) {
    try { return fs.readFileSync(c); } catch { /* try next */ }
  }
  return null;
}

// ── Tablet-page theme ──────────────────────────────────────────────────────
const PAGE_BG = '#0a1f12';   // deep green
const PANEL_BG = '#15301f';  // lighter green card
const GOLD = '#c9a42c';
const WHITE = '#f4f7f5';
const MUTED = '#9fb8a6';
const DIVIDER = '#2a4d36';

const MARGIN = 50;

export async function generateSummaryPdf(data: SummaryData): Promise<Buffer> {
  const logoImage = await loadLogoBuffer(data.restaurantLogoUrl, UPLOADS_DIR);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, bufferPages: true });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Fonts (Cyrillic-capable on Linux; fallback handled by pdfkit itself)
    let fontRegular = 'Helvetica';
    let fontBold = 'Helvetica-Bold';
    try {
      doc.registerFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
      doc.registerFont('DejaVu-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
      fontRegular = 'DejaVu';
      fontBold = 'DejaVu-Bold';
    } catch {
      // keep Helvetica
    }

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const contentWidth = pageWidth - MARGIN * 2;

    const paintBackground = () => {
      doc.save();
      doc.rect(0, 0, pageWidth, pageHeight).fill(PAGE_BG);
      doc.restore();
    };
    doc.on('pageAdded', paintBackground);
    paintBackground();

    const t = (key: Parameters<typeof translate>[0]) => translate(key, data.locale);

    // ── Header band ──────────────────────────────────────────────────────
    const headerH = 110;
    doc.save();
    doc.roundedRect(MARGIN, MARGIN, contentWidth, headerH, 14).fill(PANEL_BG);
    doc.restore();

    const padX = MARGIN + 22;
    let textX = padX;
    if (logoImage) {
      try {
        doc.image(logoImage, padX, MARGIN + 22, { fit: [66, 66] });
        textX = padX + 84;
      } catch { /* ignore */ }
    }

    doc.fillColor(GOLD).font(fontBold, 22)
      .text(data.restaurantName || 'Restaurant', textX, MARGIN + 30, { width: contentWidth - (textX - MARGIN) - 22 });
    doc.fillColor(MUTED).font(fontRegular, 12)
      .text(t('selection_summary'), textX, MARGIN + 62, { width: contentWidth - (textX - MARGIN) - 22 });

    doc.y = MARGIN + headerH + 24;

    // ── Section helper: gold title with accent bar + divider ─────────────
    const section = (title: string) => {
      if (doc.y > pageHeight - 120) doc.addPage();
      const y = doc.y;
      doc.save();
      doc.roundedRect(MARGIN, y, 4, 16, 2).fill(GOLD);
      doc.restore();
      doc.fillColor(GOLD).font(fontBold, 14).text(title, MARGIN + 14, y, { width: contentWidth - 14 });
      doc.moveDown(0.4);
      const ly = doc.y;
      doc.save();
      doc.moveTo(MARGIN, ly).lineTo(pageWidth - MARGIN, ly).lineWidth(0.6).strokeColor(DIVIDER).stroke();
      doc.restore();
      doc.moveDown(0.5);
    };

    const labelValue = (label: string, value: string) => {
      const y = doc.y;
      doc.fillColor(MUTED).font(fontRegular, 11).text(`${label}:`, MARGIN, y, { continued: true });
      doc.fillColor(WHITE).font(fontBold, 11).text(`  ${value}`);
    };

    const priceRow = (label: string, value: string, emphasize = false) => {
      const y = doc.y;
      doc.fillColor(emphasize ? GOLD : MUTED).font(emphasize ? fontBold : fontRegular, emphasize ? 13 : 11)
        .text(label, MARGIN, y, { width: contentWidth * 0.6, continued: false });
      doc.fillColor(emphasize ? GOLD : WHITE).font(fontBold, emphasize ? 13 : 11)
        .text(value, MARGIN, y, { width: contentWidth, align: 'right' });
    };

    // ── Customer ──────────────────────────────────────────────────────────
    section(t('customer_information'));
    labelValue(t('name'), data.customerName);
    labelValue(t('phone'), data.customerPhone);
    doc.moveDown(1);

    // ── Event details ───────────────────────────────────────────────────
    section(t('event_details'));
    labelValue(t('hall'), data.hallName);
    labelValue(t('table_category'), data.tableCategoryName);
    labelValue(t('guest_count'), String(data.guestCount));
    doc.moveDown(1);

    // ── Dishes included with the chosen table (grouped into category blocks) ─
    const includedDishes = data.includedDishes ?? [];
    if (includedDishes.length > 0) {
      section(t('included_with_table'));

      // Group dishes into category blocks, preserving first-seen order.
      type IncludedBlock = { label: string; dishes: typeof includedDishes };
      const blocks: IncludedBlock[] = [];
      const blockByCat = new Map<string, IncludedBlock>();
      for (const dish of includedDishes) {
        let block = blockByCat.get(dish.category);
        if (!block) {
          block = { label: dish.categoryLabel || dish.category, dishes: [] };
          blockByCat.set(dish.category, block);
          blocks.push(block);
        }
        block.dishes.push(dish);
      }

      blocks.forEach((block, bi) => {
        if (doc.y > pageHeight - 90) doc.addPage();
        // Category (block) heading
        doc.fillColor(GOLD).font(fontBold, 11).text(block.label, MARGIN, doc.y, { width: contentWidth });
        doc.moveDown(0.25);
        block.dishes.forEach((dish) => {
          const servings = dish.servings ?? 1;
          const y = doc.y;
          doc.fillColor(WHITE).font(fontRegular, 11)
            .text(`•  ${dish.name}`, MARGIN + 8, y, { width: contentWidth * 0.72 });
          doc.fillColor(GOLD).font(fontBold, 11)
            .text(`× ${servings}`, MARGIN, y, { width: contentWidth - 4, align: 'right' });
          doc.moveDown(0.2);
        });
        // Separator between category blocks (not after the last one).
        if (bi < blocks.length - 1) {
          doc.moveDown(0.35);
          const sy = doc.y;
          doc.save();
          doc.moveTo(MARGIN, sy).lineTo(pageWidth - MARGIN, sy).lineWidth(0.5).strokeColor(DIVIDER).dash(2, { space: 2 }).stroke();
          doc.undash();
          doc.restore();
          doc.moveDown(0.45);
        }
      });
      doc.moveDown(0.7);
    }

    // ── Menu items ──────────────────────────────────────────────────────
    section(t('selected_menu_items'));
    const selectedMenuItems = data.menuItems.filter((item) => data.selectedItems[item.id] > 0);
    if (selectedMenuItems.length === 0) {
      doc.fillColor(MUTED).font(fontRegular, 11).text('—', MARGIN);
    }
    selectedMenuItems.forEach((item) => {
      const quantity = data.selectedItems[item.id];
      const itemTotal = item.priceCents * quantity;
      const y = doc.y;
      doc.fillColor(WHITE).font(fontRegular, 11)
        .text(`${item.name}  ×${quantity}`, MARGIN, y, { width: contentWidth * 0.65, continued: false });
      doc.fillColor(GOLD).font(fontBold, 11)
        .text(formatSom(itemTotal), MARGIN, y, { width: contentWidth, align: 'right' });
      if (item.description) {
        doc.fillColor(MUTED).font(fontRegular, 9).text(item.description, MARGIN + 12, doc.y, { width: contentWidth - 12 });
      }
      doc.moveDown(0.3);
    });
    doc.moveDown(0.7);

    // ── Pricing (price per guest + total) ───────────────────────────────
    section(t('pricing'));
    const hasDiscount = !!data.pricing.hasDiscount && (data.pricing.discountPercent ?? 0) > 0;

    // A right-aligned label row whose value is struck through.
    const struckRow = (label: string, value: string) => {
      const oy = doc.y;
      doc.fillColor(MUTED).font(fontRegular, 11).text(label, MARGIN, oy, { width: contentWidth * 0.6 });
      doc.fillColor(MUTED).font(fontRegular, 11).text(value, MARGIN, oy, { width: contentWidth, align: 'right' });
      const tw = doc.widthOfString(value);
      const lineY = oy + 7;
      doc.save();
      doc.moveTo(pageWidth - MARGIN - tw, lineY).lineTo(pageWidth - MARGIN, lineY).lineWidth(0.8).strokeColor(MUTED).stroke();
      doc.restore();
    };

    if (hasDiscount) {
      priceRow(t('discount'), `−${data.pricing.discountPercent}%`);
    }
    // Price per guest
    if (hasDiscount && data.pricing.originalPerGuestCents != null) {
      struckRow(`${t('price_per_guest')} (${t('original_price')})`, formatSom(data.pricing.originalPerGuestCents));
    }
    priceRow(t('price_per_guest'), formatSom(data.pricing.perGuestCents), true);
    doc.moveDown(0.3);
    // Total
    const totalCents = data.pricing.totalCents ?? data.pricing.perGuestCents;
    if (hasDiscount && data.pricing.originalTotalCents != null) {
      struckRow(`${t('total')} (${t('original_price')})`, formatSom(data.pricing.originalTotalCents));
    }
    priceRow(t('total'), formatSom(totalCents), true);
    doc.moveDown(1);

    // ── Footer ──────────────────────────────────────────────────────────
    if (doc.y > pageHeight - 140) doc.addPage();
    const fy = doc.y;
    const footerH = 84;
    doc.save();
    doc.roundedRect(MARGIN, fy, contentWidth, footerH, 12).fill(PANEL_BG);
    doc.restore();
    doc.fillColor(WHITE).font(fontRegular, 11)
      .text(t('thank_you_message'), MARGIN + 18, fy + 16, { width: contentWidth - 36 });
    doc.fillColor(GOLD).font(fontBold, 14)
      .text(`${t('total')}: ${formatSom(totalCents)}`, MARGIN + 18, fy + 50, { width: contentWidth - 36 });

    doc.end();
  });
}
