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
  pricing: {
    subtotalCents: number;
    serviceFeeCents: number;
    taxCents: number;
    totalCents: number;
    perGuestCents: number;
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

    // ── Pricing ─────────────────────────────────────────────────────────
    section(t('pricing'));
    priceRow(t('subtotal'), formatSom(data.pricing.subtotalCents));
    priceRow(t('service_fee'), formatSom(data.pricing.serviceFeeCents));
    priceRow(t('tax'), formatSom(data.pricing.taxCents));
    doc.moveDown(0.2);
    priceRow(t('total'), formatSom(data.pricing.totalCents), true);
    if (data.guestCount > 1) {
      priceRow(t('price_per_guest'), formatSom(data.pricing.perGuestCents));
    }
    doc.moveDown(1);

    // ── Summary footer ──────────────────────────────────────────────────
    if (doc.y > pageHeight - 140) doc.addPage();
    const fy = doc.y;
    const footerH = 84;
    doc.save();
    doc.roundedRect(MARGIN, fy, contentWidth, footerH, 12).fill(PANEL_BG);
    doc.restore();
    doc.fillColor(WHITE).font(fontRegular, 11)
      .text(t('thank_you_message'), MARGIN + 18, fy + 16, { width: contentWidth - 36 });
    doc.fillColor(GOLD).font(fontBold, 14)
      .text(`${t('estimated_total')}: ${formatSom(data.pricing.totalCents)}`, MARGIN + 18, fy + 50, { width: contentWidth - 36 });

    doc.end();
  });
}
