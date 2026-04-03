import ExcelJS from 'exceljs';
import createHttpError from 'http-errors';
import PDFDocument from 'pdfkit';
const formatMoney = (cents) => (cents / 100).toFixed(2);
export class ExportService {
    eventRepository;
    pricingService;
    constructor(eventRepository, pricingService) {
        this.eventRepository = eventRepository;
        this.pricingService = pricingService;
    }
    async createEventExcel(eventId) {
        const event = await this.eventRepository.getById(eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        const pricing = await this.pricingService.calculateEventPricing(eventId);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Banquet Summary');
        sheet.columns = [
            { header: 'Item', key: 'item', width: 30 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'Unit Price', key: 'unitPrice', width: 15 },
            { header: 'Total', key: 'total', width: 15 }
        ];
        for (const selection of event.selections) {
            sheet.addRow({
                item: selection.menuItem.name,
                quantity: selection.quantity,
                unitPrice: formatMoney(selection.unitPriceCents),
                total: formatMoney(selection.quantity * selection.unitPriceCents)
            });
        }
        sheet.addRow({});
        sheet.addRow({ item: 'Subtotal', total: formatMoney(pricing.subtotalCents) });
        sheet.addRow({ item: 'Service Fee', total: formatMoney(pricing.serviceFeeCents) });
        sheet.addRow({ item: 'Tax', total: formatMoney(pricing.taxCents) });
        sheet.addRow({ item: 'Grand Total', total: formatMoney(pricing.totalCents) });
        return Buffer.from(await workbook.xlsx.writeBuffer());
    }
    async createEventPdf(eventId) {
        const event = await this.eventRepository.getById(eventId);
        if (!event) {
            throw createHttpError(404, 'Event not found');
        }
        const pricing = await this.pricingService.calculateEventPricing(eventId);
        const pdf = new PDFDocument({ margin: 40 });
        const chunks = [];
        return await new Promise((resolve, reject) => {
            pdf.on('data', (chunk) => chunks.push(chunk));
            pdf.on('end', () => resolve(Buffer.concat(chunks)));
            pdf.on('error', reject);
            pdf.fontSize(18).text('Banquet Event Summary');
            pdf.moveDown();
            pdf.fontSize(12).text(`Customer: ${event.customerName}`);
            pdf.text(`Event Date: ${event.eventDate.toISOString()}`);
            pdf.text(`Guests: ${event.guestCount}`);
            pdf.moveDown();
            pdf.text('Selections:');
            event.selections.forEach((selection) => {
                const total = formatMoney(selection.quantity * selection.unitPriceCents);
                pdf.text(`- ${selection.menuItem.name} x${selection.quantity} = $${total}`);
            });
            pdf.moveDown();
            pdf.text(`Subtotal: $${formatMoney(pricing.subtotalCents)}`);
            pdf.text(`Service Fee: $${formatMoney(pricing.serviceFeeCents)}`);
            pdf.text(`Tax: $${formatMoney(pricing.taxCents)}`);
            pdf.text(`Total: $${formatMoney(pricing.totalCents)}`);
            pdf.end();
        });
    }
}
