import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

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
      ext: { width: 100, height: 100 }
    });
  }

  // Title (adjusted position if logo is present)
  const titleRow = logoImageId !== undefined ? 8 : 1;
  worksheet.mergeCells(`A${titleRow}:D${titleRow}`);
  const titleCell = worksheet.getCell(`A${titleRow}`);
  titleCell.value = 'Selection Summary';
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // Customer Information
  worksheet.addRow([]);
  worksheet.addRow(['Customer Information']);
  const customerInfoRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${customerInfoRow}`).font = { bold: true, size: 14 };
  worksheet.addRow(['Name', data.customerName]);
  worksheet.addRow(['Phone', data.customerPhone]);

  // Event Details
  worksheet.addRow([]);
  worksheet.addRow(['Event Details']);
  const eventDetailsRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${eventDetailsRow}`).font = { bold: true, size: 14 };
  worksheet.addRow(['Hall', data.hallName]);
  worksheet.addRow(['Table Category', data.tableCategoryName]);
  worksheet.addRow(['Guest Count', data.guestCount]);

  // Selected Menu Items
  worksheet.addRow([]);
  worksheet.addRow(['Selected Menu Items']);
  const menuItemsRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${menuItemsRow}`).font = { bold: true, size: 14 };
  worksheet.addRow(['Item Name', 'Category', 'Quantity', 'Unit Price', 'Total Price']);

  // Header styling
  const headerExcelRow = worksheet.lastRow!;
  headerExcelRow.font = { bold: true };
  headerExcelRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6E6FA' }
  };

  // Add menu items
  const selectedMenuItems = data.menuItems.filter(item => data.selectedItems[item.id] > 0);
  selectedMenuItems.forEach(item => {
    const quantity = data.selectedItems[item.id];
    const unitPrice = item.priceCents / 100;
    const totalPrice = (item.priceCents * quantity) / 100;

    worksheet.addRow([
      item.name,
      item.category,
      quantity,
      unitPrice,
      totalPrice
    ]);

    if (item.description) {
      worksheet.addRow([item.description, '', '', '', '']);
      worksheet.lastRow!.font = { italic: true, size: 10 };
    }
  });

  // Pricing
  worksheet.addRow([]);
  worksheet.addRow(['Pricing']);
  const pricingRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${pricingRow}`).font = { bold: true, size: 14 };

  worksheet.addRow(['Subtotal', '', '', '', data.pricing.subtotalCents / 100]);
  worksheet.addRow(['Service Fee', '', '', '', data.pricing.serviceFeeCents / 100]);
  worksheet.addRow(['Tax', '', '', '', data.pricing.taxCents / 100]);
  worksheet.addRow(['Total', '', '', '', data.pricing.totalCents / 100]);

  if (data.guestCount > 1) {
    worksheet.addRow(['Price per Guest', '', '', '', data.pricing.perGuestCents / 100]);
  }

  // Summary
  worksheet.addRow([]);
  worksheet.addRow(['Summary']);
  const summaryRow = worksheet.lastRow!.number;
  worksheet.getCell(`A${summaryRow}`).font = { bold: true, size: 14 };
  worksheet.addRow([`Thank you for choosing our banquet services. Your selection has been recorded.`]);
  worksheet.addRow([`Total guests: ${data.guestCount}`]);
  worksheet.addRow([`Estimated total: $${(data.pricing.totalCents / 100).toFixed(2)}`]);

  // Auto-fit columns
  worksheet.columns.forEach(column => {
    column.width = 20;
  });

  // Format currency columns
  worksheet.getColumn(5).numFmt = '$#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}