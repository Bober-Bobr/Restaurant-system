import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import { translate, type Locale } from '../../utils/translate.js';
import { tiyinToSom, formatSom } from '../../utils/currency.js';
import { loadLogoBuffer } from './pdf.service.js';

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
  pricing: {
    perGuestCents: number;
    originalPerGuestCents?: number;
    discountPercent?: number;
    hasDiscount?: boolean;
  };
  locale: Locale;
  restaurantName?: string;
  restaurantLogoUrl?: string | null;
}

export async function generateSummaryExcel(data: SummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Selection Summary');

  // Load logo — prefer the restaurant's own, fall back to system logo
  const logoBuffer = await loadLogoBuffer(data.restaurantLogoUrl, UPLOADS_DIR);
  const logoExt: 'png' | 'jpeg' = /\.jpe?g$/i.test(data.restaurantLogoUrl ?? '') ? 'jpeg' : 'png';

  let logoImageId: number | undefined;
  if (logoBuffer) {
    logoImageId = workbook.addImage({
      buffer: logoBuffer as any,
      extension: logoExt,
    });
  }

  // Add logo if available
  if (logoImageId !== undefined) {
    worksheet.addImage(logoImageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 100 }
    });
  }

  // Restaurant name (prominent header)
  const headerRow = logoImageId !== undefined ? 8 : 1;
  worksheet.mergeCells(`A${headerRow}:E${headerRow}`);
  const restaurantNameCell = worksheet.getCell(`A${headerRow}`);
  restaurantNameCell.value = data.restaurantName || 'Restaurant';
  restaurantNameCell.font = { size: 18, bold: true, color: { argb: 'FF1F4E78' } };
  restaurantNameCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.getRow(headerRow).height = 30;

  // Title
  const titleRow = headerRow + 1;
  worksheet.mergeCells(`A${titleRow}:E${titleRow}`);
  const titleCell = worksheet.getCell(`A${titleRow}`);
  titleCell.value = translate('selection_summary', data.locale);
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  worksheet.getRow(titleRow).height = 25;

  // Customer Information
  worksheet.addRow([]);
  worksheet.addRow([translate('customer_information', data.locale)]);
  const customerInfoRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${customerInfoRow}`).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  worksheet.getCell(`A${customerInfoRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };
  worksheet.addRow([translate('name', data.locale), data.customerName]);
  const nameRow = worksheet.lastRow!;
  nameRow.eachCell((cell) => {
    cell.font = { ...cell.font, family: 2 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
  worksheet.addRow([translate('phone', data.locale), data.customerPhone]);
  const phoneRow = worksheet.lastRow!;
  phoneRow.eachCell((cell) => {
    cell.font = { ...cell.font, family: 2 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });

  // Event Details
  worksheet.addRow([]);
  worksheet.addRow([translate('event_details', data.locale)]);
  const eventDetailsRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${eventDetailsRow}`).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  worksheet.getCell(`A${eventDetailsRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };
  worksheet.addRow([translate('hall', data.locale), data.hallName]);
  const hallRow = worksheet.lastRow!;
  hallRow.eachCell((cell) => {
    cell.font = { ...cell.font, family: 2 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
  worksheet.addRow([translate('table_category', data.locale), data.tableCategoryName]);
  const tableRow = worksheet.lastRow!;
  tableRow.eachCell((cell) => {
    cell.font = { ...cell.font, family: 2 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });
  worksheet.addRow([translate('guest_count', data.locale), data.guestCount]);
  const guestRow = worksheet.lastRow!;
  guestRow.eachCell((cell) => {
    cell.font = { ...cell.font, family: 2 };
    cell.alignment = { wrapText: true, vertical: 'top' };
  });

  // Selected Menu Items
  worksheet.addRow([]);
  worksheet.addRow([translate('selected_menu_items', data.locale)]);
  const menuItemsRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${menuItemsRow}`).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  worksheet.getCell(`A${menuItemsRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };
  worksheet.addRow([
    translate('item_name', data.locale),
    translate('category', data.locale),
    translate('quantity', data.locale),
    translate('unit_price', data.locale),
    translate('total_price', data.locale)
  ]);

  // Header styling
  const headerExcelRow = worksheet.lastRow!;
  headerExcelRow.font = { bold: true, family: 2 };
  headerExcelRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD9E1F2' }
  };
  headerExcelRow.eachCell((cell) => {
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });

  // Add menu items with proper font support
  const selectedMenuItems = data.menuItems.filter(item => data.selectedItems[item.id] > 0);
  selectedMenuItems.forEach(item => {
    const quantity = data.selectedItems[item.id];
    const unitPrice = tiyinToSom(item.priceCents);
    const totalPrice = tiyinToSom(item.priceCents * quantity);

    const itemRow = worksheet.addRow([
      item.name,
      item.category,
      quantity,
      unitPrice,
      totalPrice
    ]);
    itemRow.eachCell((cell) => {
      cell.font = { ...cell.font, family: 2 };
      cell.alignment = { wrapText: true, vertical: 'top' };
    });

    if (item.description) {
      const descRow = worksheet.addRow([item.description, '', '', '', '']);
      descRow.font = { italic: true, size: 10, family: 2 };
      descRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
    }
  });

  // Pricing
  worksheet.addRow([]);
  worksheet.addRow([translate('pricing', data.locale)]);
  const pricingRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${pricingRow}`).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  worksheet.getCell(`A${pricingRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };

  const hasDiscount = !!data.pricing.hasDiscount && (data.pricing.discountPercent ?? 0) > 0;
  if (hasDiscount && data.pricing.originalPerGuestCents != null) {
    const origRow = worksheet.addRow([translate('original_price', data.locale), '', '', '', tiyinToSom(data.pricing.originalPerGuestCents)]);
    origRow.getCell(1).font = { ...origRow.getCell(1).font, family: 2 };
    // Strike-through the original per-guest price to show it's superseded
    origRow.getCell(5).font = { family: 2, strike: true, color: { argb: 'FF888888' } };
    origRow.eachCell((cell) => { cell.alignment = { wrapText: true }; });

    const discRow = worksheet.addRow([`${translate('discount', data.locale)} (−${data.pricing.discountPercent}%)`, '', '', '', '']);
    discRow.getCell(1).font = { family: 2, color: { argb: 'FFC00000' }, bold: true };
    discRow.eachCell((cell) => { cell.alignment = { wrapText: true }; });
  }

  const perGuestRow = worksheet.addRow([translate('price_per_guest', data.locale), '', '', '', tiyinToSom(data.pricing.perGuestCents)]);
  perGuestRow.getCell(1).font = { bold: true, family: 2 };
  perGuestRow.getCell(5).font = { bold: true, family: 2 };
  perGuestRow.eachCell((cell) => { cell.alignment = { wrapText: true }; });

  // Summary
  worksheet.addRow([]);
  worksheet.addRow([translate('summary', data.locale)]);
  const summaryRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 14, color: { argb: 'FF1F4E78' } };
  worksheet.getCell(`A${summaryRow}`).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };
  const thankYouRow = worksheet.addRow([translate('thank_you_message', data.locale)]);
  thankYouRow.getCell(1).font = { family: 2, size: 11 };
  thankYouRow.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  worksheet.mergeCells(`A${thankYouRow.number}:E${thankYouRow.number}`);
  worksheet.getRow(thankYouRow.number).height = 30;

  const guestsRow = worksheet.addRow([`${translate('total_guests', data.locale)}: ${data.guestCount}`]);
  guestsRow.getCell(1).font = { family: 2 };
  guestsRow.getCell(1).alignment = { wrapText: true };

  const perGuestSummaryRow = worksheet.addRow([`${translate('price_per_guest', data.locale)}: ${formatSom(data.pricing.perGuestCents)}`]);
  perGuestSummaryRow.getCell(1).font = { bold: true, family: 2 };
  perGuestSummaryRow.getCell(1).alignment = { wrapText: true };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 25;
  });

  // Format currency columns as Uzbek so'm (whole numbers, thousands-separated)
  worksheet.getColumn(4).numFmt = '#,##0" so\'m"';
  worksheet.getColumn(5).numFmt = '#,##0" so\'m"';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}