import ExcelJS from 'exceljs';
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

export async function generateSummaryExcel(data: SummaryData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Selection Summary');

  // Load logo
  const logoPath = path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo.png');
  let logoImageId: number | undefined;
  try {
    const logoBuffer = fs.readFileSync(logoPath);
    logoImageId = workbook.addImage({
      buffer: logoBuffer as any,
      extension: 'png',
    });
  } catch (error) {
    // Logo not found, continue without it
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
    const unitPrice = item.priceCents / 100;
    const totalPrice = (item.priceCents * quantity) / 100;

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

  const subtotalRow = worksheet.addRow([translate('subtotal', data.locale), '', '', '', data.pricing.subtotalCents / 100]);
  subtotalRow.eachCell((cell) => { cell.font = { ...cell.font, family: 2 }; cell.alignment = { wrapText: true }; });
  
  const feeRow = worksheet.addRow([translate('service_fee', data.locale), '', '', '', data.pricing.serviceFeeCents / 100]);
  feeRow.eachCell((cell) => { cell.font = { ...cell.font, family: 2 }; cell.alignment = { wrapText: true }; });
  
  const taxRow = worksheet.addRow([translate('tax', data.locale), '', '', '', data.pricing.taxCents / 100]);
  taxRow.eachCell((cell) => { cell.font = { ...cell.font, family: 2 }; cell.alignment = { wrapText: true }; });
  
  const totalRow = worksheet.addRow([translate('total', data.locale), '', '', '', data.pricing.totalCents / 100]);
  totalRow.getCell(1).font = { bold: true, family: 2 };
  totalRow.getCell(5).font = { bold: true, family: 2 };
  totalRow.eachCell((cell) => { cell.alignment = { wrapText: true }; });

  if (data.guestCount > 1) {
    const perGuestRow = worksheet.addRow([translate('price_per_guest', data.locale), '', '', '', data.pricing.perGuestCents / 100]);
    perGuestRow.eachCell((cell) => { cell.font = { ...cell.font, family: 2 }; cell.alignment = { wrapText: true }; });
  }

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

  const totalRow2 = worksheet.addRow([`${translate('estimated_total', data.locale)}: $${(data.pricing.totalCents / 100).toFixed(2)}`]);
  totalRow2.getCell(1).font = { bold: true, family: 2 };
  totalRow2.getCell(1).alignment = { wrapText: true };

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 25;
  });

  // Format currency columns
  worksheet.getColumn(5).numFmt = '$#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}