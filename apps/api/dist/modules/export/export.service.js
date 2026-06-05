import ExcelJS from 'exceljs';
import createHttpError from 'http-errors';
import PDFDocument from 'pdfkit';
import { formatSom, tiyinToSom } from '../../utils/currency.js';
// Tablet-page theme
const PAGE_BG = '#0a1f12';
const PANEL_BG = '#15301f';
const GOLD = '#c9a42c';
const WHITE = '#f4f7f5';
const MUTED = '#9fb8a6';
const DIVIDER = '#2a4d36';
export class ExportService {
    eventRepository;
    pricingService;
    constructor(eventRepository, pricingService) {
        this.eventRepository = eventRepository;
        this.pricingService = pricingService;
    }
    async createEventExcel(restaurantId, eventId) {
        const event = await this.eventRepository.getByNumber(restaurantId, eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        const pricing = await this.pricingService.calculateEventPricing(restaurantId, eventId);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Banquet Summary');
        sheet.columns = [
            { header: 'Item', key: 'item', width: 30 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Unit Price', key: 'unitPrice', width: 18 },
            { header: 'Total', key: 'total', width: 18 }
        ];
        for (const selection of event.selections) {
            sheet.addRow({
                item: selection.menuItem.name,
                quantity: selection.quantity,
                unitPrice: tiyinToSom(selection.unitPriceCents),
                total: tiyinToSom(selection.quantity * selection.unitPriceCents)
            });
        }
        sheet.addRow({});
        sheet.addRow({ item: 'Subtotal', total: tiyinToSom(pricing.subtotalCents) });
        sheet.addRow({ item: 'Service Fee', total: tiyinToSom(pricing.serviceFeeCents) });
        sheet.addRow({ item: 'Tax', total: tiyinToSom(pricing.taxCents) });
        sheet.addRow({ item: 'Grand Total', total: tiyinToSom(pricing.totalCents) });
        // Display money columns as Uzbek so'm
        sheet.getColumn('unitPrice').numFmt = '#,##0" so\'m"';
        sheet.getColumn('total').numFmt = '#,##0" so\'m"';
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }
    async createEventPdf(restaurantId, eventId) {
        const event = await this.eventRepository.getByNumber(restaurantId, eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        const pricing = await this.pricingService.calculateEventPricing(restaurantId, eventId);
        const MARGIN = 44;
        const pdf = new PDFDocument({ margin: MARGIN });
        const chunks = [];
        let fontRegular = 'Helvetica';
        let fontBold = 'Helvetica-Bold';
        try {
            pdf.registerFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
            pdf.registerFont('DejaVu-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
            fontRegular = 'DejaVu';
            fontBold = 'DejaVu-Bold';
        }
        catch { /* keep Helvetica */ }
        const pageWidth = pdf.page.width;
        const pageHeight = pdf.page.height;
        const contentWidth = pageWidth - MARGIN * 2;
        const paintBackground = () => {
            pdf.save();
            pdf.rect(0, 0, pageWidth, pageHeight).fill(PAGE_BG);
            pdf.restore();
        };
        pdf.on('pageAdded', paintBackground);
        paintBackground();
        return await new Promise((resolve, reject) => {
            pdf.on('data', (chunk) => chunks.push(chunk));
            pdf.on('end', () => resolve(Buffer.concat(chunks)));
            pdf.on('error', reject);
            // Header band
            pdf.save();
            pdf.roundedRect(MARGIN, MARGIN, contentWidth, 60, 12).fill(PANEL_BG);
            pdf.restore();
            pdf.fillColor(GOLD).font(fontBold, 20).text('Banquet Event Summary', MARGIN + 18, MARGIN + 19, { width: contentWidth - 36 });
            pdf.y = MARGIN + 84;
            const labelValue = (label, value) => {
                const y = pdf.y;
                pdf.fillColor(MUTED).font(fontRegular, 11).text(`${label}:`, MARGIN, y, { continued: true });
                pdf.fillColor(WHITE).font(fontBold, 11).text(`  ${value}`);
            };
            labelValue('Customer', event.customerName);
            labelValue('Event Date', event.eventDate.toLocaleString());
            labelValue('Guests', String(event.guestCount));
            pdf.moveDown(1);
            // Selections title + divider
            pdf.fillColor(GOLD).font(fontBold, 14).text('Selections', MARGIN);
            const ly = pdf.y + 2;
            pdf.save();
            pdf.moveTo(MARGIN, ly).lineTo(pageWidth - MARGIN, ly).lineWidth(0.6).strokeColor(DIVIDER).stroke();
            pdf.restore();
            pdf.moveDown(0.6);
            event.selections.forEach((selection) => {
                const total = formatSom(selection.quantity * selection.unitPriceCents);
                const y = pdf.y;
                pdf.fillColor(WHITE).font(fontRegular, 11)
                    .text(`${selection.menuItem.name}  ×${selection.quantity}`, MARGIN, y, { width: contentWidth * 0.65 });
                pdf.fillColor(GOLD).font(fontBold, 11)
                    .text(total, MARGIN, y, { width: contentWidth, align: 'right' });
                pdf.moveDown(0.3);
            });
            pdf.moveDown(0.7);
            const priceRow = (label, value, emphasize = false) => {
                const y = pdf.y;
                pdf.fillColor(emphasize ? GOLD : MUTED).font(emphasize ? fontBold : fontRegular, emphasize ? 13 : 11)
                    .text(label, MARGIN, y, { width: contentWidth * 0.6 });
                pdf.fillColor(emphasize ? GOLD : WHITE).font(fontBold, emphasize ? 13 : 11)
                    .text(value, MARGIN, y, { width: contentWidth, align: 'right' });
            };
            priceRow('Subtotal', formatSom(pricing.subtotalCents));
            priceRow('Service Fee', formatSom(pricing.serviceFeeCents));
            priceRow('Tax', formatSom(pricing.taxCents));
            pdf.moveDown(0.2);
            priceRow('Total', formatSom(pricing.totalCents), true);
            pdf.end();
        });
    }
}
