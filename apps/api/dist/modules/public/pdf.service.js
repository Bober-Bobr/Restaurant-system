import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
export async function generateSummaryPdf(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });
        doc.on('error', reject);
        // Load logo (assuming it's in the assets folder)
        const logoPath = path.join(process.cwd(), 'apps', 'api', 'src', 'assets', 'logo.png');
        let logoImage = null;
        try {
            logoImage = fs.readFileSync(logoPath);
        }
        catch (error) {
            // Logo not found, continue without it
        }
        // Header with logo
        if (logoImage) {
            doc.image(logoImage, 50, 50, { width: 100 });
        }
        doc.fontSize(24).text('Selection Summary', 50, logoImage ? 170 : 50);
        doc.moveDown();
        // Customer Information
        doc.fontSize(16).text('Customer Information', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Name: ${data.customerName}`);
        doc.text(`Phone: ${data.customerPhone}`);
        doc.moveDown();
        // Event Details
        doc.fontSize(16).text('Event Details', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Hall: ${data.hallName}`);
        doc.text(`Table Category: ${data.tableCategoryName}`);
        doc.text(`Guest Count: ${data.guestCount}`);
        doc.moveDown();
        // Menu
        doc.fontSize(16).text('Selected Menu Items', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        const selectedMenuItems = data.menuItems.filter(item => data.selectedItems[item.id] > 0);
        selectedMenuItems.forEach(item => {
            const quantity = data.selectedItems[item.id];
            const itemTotal = (item.priceCents * quantity) / 100;
            doc.text(`${item.name} (x${quantity}) - $${itemTotal.toFixed(2)}`);
            if (item.description) {
                doc.fontSize(10).text(`  ${item.description}`, { indent: 20 });
                doc.fontSize(12);
            }
        });
        doc.moveDown();
        // Prices
        doc.fontSize(16).text('Pricing', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Subtotal: $${(data.pricing.subtotalCents / 100).toFixed(2)}`);
        doc.text(`Service Fee: $${(data.pricing.serviceFeeCents / 100).toFixed(2)}`);
        doc.text(`Tax: $${(data.pricing.taxCents / 100).toFixed(2)}`);
        doc.text(`Total: $${(data.pricing.totalCents / 100).toFixed(2)}`);
        if (data.guestCount > 1) {
            doc.text(`Price per Guest: $${(data.pricing.perGuestCents / 100).toFixed(2)}`);
        }
        doc.moveDown();
        // Summary
        doc.fontSize(16).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12);
        doc.text(`Thank you for choosing our banquet services. Your selection has been recorded.`);
        doc.text(`Total guests: ${data.guestCount}`);
        doc.text(`Estimated total: $${(data.pricing.totalCents / 100).toFixed(2)}`);
        doc.end();
    });
}
