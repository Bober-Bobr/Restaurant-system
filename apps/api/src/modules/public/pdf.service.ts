import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { translate, type Locale } from '../../utils/translate.js';

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
}

export async function generateSummaryPdf(data: SummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', reject);

    // Register Cyrillic-compatible fonts
    try {
      // Try to register DejaVuSans fonts (common on Linux)
      doc.registerFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
      doc.registerFont('DejaVu-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
    } catch (error) {
      // Fonts not available, fallback to Helvetica
      // This may cause issues with Cyrillic text
    }

    // Load logo
    const logoPath = path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo.png');
    let logoImage: Buffer | null = null;
    try {
      logoImage = fs.readFileSync(logoPath);
    } catch (error) {
      // Logo not found, continue without it
    }

    // Header with logo and restaurant name
    const headerY = 50;
    const logoWidth = 80;
    const logoHeight = 80;

    if (logoImage) {
      doc.image(logoImage, 50, headerY, { width: logoWidth, height: logoHeight });
    }

    // Restaurant name and title on the right of logo
    const contentX = logoImage ? 50 + logoWidth + 30 : 50;
    const restaurantName = data.restaurantName || 'Restaurant';
    
    doc.font('DejaVu-Bold', 20).text(restaurantName, contentX, headerY + 10);
    doc.font('DejaVu', 12).text(translate('selection_summary', data.locale), contentX, headerY + 40, { width: 350 });
    
    doc.moveDown(5);

    // Customer Information
    doc.font('DejaVu-Bold', 14).text(translate('customer_information', data.locale), { underline: true });
    doc.moveDown(0.5);
    doc.font('DejaVu', 11).text(`${translate('name', data.locale)}: ${data.customerName}`);
    doc.text(`${translate('phone', data.locale)}: ${data.customerPhone}`);
    doc.moveDown();

    // Event Details
    doc.font('DejaVu-Bold', 14).text(translate('event_details', data.locale), { underline: true });
    doc.moveDown(0.5);
    doc.font('DejaVu', 11).text(`${translate('hall', data.locale)}: ${data.hallName}`);
    doc.text(`${translate('table_category', data.locale)}: ${data.tableCategoryName}`);
    doc.text(`${translate('guest_count', data.locale)}: ${data.guestCount}`);
    doc.moveDown();

    // Menu
    doc.font('DejaVu-Bold', 14).text(translate('selected_menu_items', data.locale), { underline: true });
    doc.moveDown(0.5);
    doc.font('DejaVu', 11);

    const selectedMenuItems = data.menuItems.filter(item => data.selectedItems[item.id] > 0);
    selectedMenuItems.forEach(item => {
      const quantity = data.selectedItems[item.id];
      const itemTotal = (item.priceCents * quantity) / 100;
      doc.text(`${item.name} (x${quantity}) - $${itemTotal.toFixed(2)}`);
      if (item.description) {
        doc.font('DejaVu', 9).text(`  ${item.description}`, { indent: 20 });
        doc.font('DejaVu', 11);
      }
    });
    doc.moveDown();

    // Prices
    doc.font('DejaVu-Bold', 14).text(translate('pricing', data.locale), { underline: true });
    doc.moveDown(0.5);
    doc.font('DejaVu', 11);
    doc.text(`${translate('subtotal', data.locale)}: $${(data.pricing.subtotalCents / 100).toFixed(2)}`);
    doc.text(`${translate('service_fee', data.locale)}: $${(data.pricing.serviceFeeCents / 100).toFixed(2)}`);
    doc.text(`${translate('tax', data.locale)}: $${(data.pricing.taxCents / 100).toFixed(2)}`);
    doc.text(`${translate('total', data.locale)}: $${(data.pricing.totalCents / 100).toFixed(2)}`);
    if (data.guestCount > 1) {
      doc.text(`${translate('price_per_guest', data.locale)}: $${(data.pricing.perGuestCents / 100).toFixed(2)}`);
    }
    doc.moveDown();

    // Summary
    doc.font('DejaVu-Bold', 14).text(translate('summary', data.locale), { underline: true });
    doc.moveDown(0.5);
    doc.font('DejaVu', 11);
    doc.text(translate('thank_you_message', data.locale));
    doc.text(`${translate('total_guests', data.locale)}: ${data.guestCount}`);
    doc.text(`${translate('estimated_total', data.locale)}: $${(data.pricing.totalCents / 100).toFixed(2)}`);

    doc.end();
  });
}