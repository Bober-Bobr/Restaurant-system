import PDFDocument from 'pdfkit';
import type { Locale } from '../../utils/translate.js';

type Line = { name: string; quantity?: number; unit?: string; amountSum: number };
export type PdfDay = {
  date: string;
  allocatedSum: number;
  report: string | null;
  products: Line[];
  salaries: { name: string; amountSum: number }[];
  additionals: { name: string; amountSum: number }[];
};

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Expense Ledger', allocated: 'Allocated funds', products: 'Product expenses',
    salaries: 'Employee salaries', additional: 'Additional expenses', spent: 'Spent',
    balance: 'Balance', totalAllocated: 'Total Allocated Funds', totalExpenses: 'Total Expenses',
    totalBalance: 'Total Balance', period: 'Period', noData: 'No data for this period.', report: 'Report'
  },
  ru: {
    title: 'Книга расходов', allocated: 'Выделено средств', products: 'Расходы на продукты',
    salaries: 'Зарплаты сотрудников', additional: 'Дополнительные расходы', spent: 'Потрачено',
    balance: 'Остаток', totalAllocated: 'Итого выделено средств', totalExpenses: 'Итого расходы',
    totalBalance: 'Итоговый баланс', period: 'Период', noData: 'Нет данных за этот период.', report: 'Отчёт'
  },
  uz: {
    title: 'Xarajatlar daftari', allocated: 'Ajratilgan mablag', products: 'Mahsulot xarajatlari',
    salaries: 'Xodimlar ish haqi', additional: 'Qoshimcha xarajatlar', spent: 'Sarflangan',
    balance: 'Qoldiq', totalAllocated: 'Jami ajratilgan mablag', totalExpenses: 'Jami xarajatlar',
    totalBalance: 'Yakuniy balans', period: 'Davr', noData: 'Bu davr uchun malumot yoq.', report: 'Hisobot'
  }
};

const fmt = (sum: number) => sum.toLocaleString('ru-RU') + " so'm";

function dayTotals(d: PdfDay) {
  const products = d.products.reduce((s, p) => s + p.amountSum, 0);
  const salaries = d.salaries.reduce((s, p) => s + p.amountSum, 0);
  const additionals = d.additionals.reduce((s, p) => s + p.amountSum, 0);
  const spent = products + salaries + additionals;
  return { spent, balance: d.allocatedSum - spent };
}

function formatDate(date: string, locale: Locale): string {
  const loc = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  try {
    return new Intl.DateTimeFormat(loc, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

export function generateExpensePdf(
  days: PdfDay[],
  range: { from: string; to: string },
  locale: Locale
): Promise<Buffer> {
  const L = LABELS[locale] ?? LABELS.en;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 44, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    let R = 'Helvetica';
    let B = 'Helvetica-Bold';
    try {
      doc.registerFont('R', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
      doc.registerFont('B', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf');
      R = 'R'; B = 'B';
    } catch { /* keep Helvetica */ }

    const ML = 44;
    const PW = doc.page.width;
    const right = PW - 44;
    const contentW = right - ML;

    // Header
    doc.font(B, 20).fillColor('#111').text(L.title, ML, 44);
    doc.font(R, 10).fillColor('#666').text(`${L.period}: ${range.from} — ${range.to}`, { continued: false });
    doc.moveDown(0.6);

    const hr = (color = '#cccccc', weight = 1) => {
      doc.moveTo(ML, doc.y).lineTo(right, doc.y).lineWidth(weight).strokeColor(color).stroke();
      doc.moveDown(0.5);
    };

    // A right-aligned label/value line on the current row.
    const kv = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
      const y = doc.y;
      doc.font(opts.bold ? B : R, 10).fillColor(opts.color ?? '#222');
      doc.text(label, ML, y, { width: contentW * 0.6, lineBreak: false });
      doc.text(value, ML, y, { width: contentW, align: 'right', lineBreak: false });
      doc.moveDown(0.5);
    };

    if (days.length === 0) {
      doc.moveDown(1).font(R, 11).fillColor('#666').text(L.noData, ML);
    }

    let totalAllocated = 0;
    let totalSpent = 0;

    for (const d of days) {
      const { spent, balance } = dayTotals(d);
      totalAllocated += d.allocatedSum;
      totalSpent += spent;

      if (doc.y > doc.page.height - 140) doc.addPage();

      doc.moveDown(0.4);
      doc.font(B, 13).fillColor('#111').text(formatDate(d.date, locale), ML);
      doc.moveDown(0.2);
      hr('#999999', 1.2);

      kv(L.allocated, fmt(d.allocatedSum), { bold: true });

      // Product expenses
      doc.font(B, 10).fillColor('#444').text(L.products, ML);
      doc.moveDown(0.3);
      for (const p of d.products) {
        const qty = p.quantity ? `  (${p.quantity} ${p.unit ?? ''})`.trimEnd() : '';
        kv(`   • ${p.name}${qty}`, fmt(p.amountSum));
      }

      // Salaries
      doc.moveDown(0.1);
      doc.font(B, 10).fillColor('#444').text(L.salaries, ML);
      doc.moveDown(0.3);
      for (const s of d.salaries) {
        kv(`   • ${s.name}`, fmt(s.amountSum));
      }

      // Additional
      if (d.additionals.length) {
        doc.moveDown(0.1);
        doc.font(B, 10).fillColor('#444').text(L.additional, ML);
        doc.moveDown(0.3);
        for (const a of d.additionals) {
          kv(`   • ${a.name}`, fmt(a.amountSum));
        }
      }

      doc.moveDown(0.2);
      kv(L.spent, fmt(spent), { bold: true, color: '#b45309' });
      kv(L.balance, fmt(balance), { bold: true, color: balance < 0 ? '#b91c1c' : '#15803d' });

      if (d.report && d.report.trim()) {
        doc.moveDown(0.3);
        doc.font(B, 10).fillColor('#444').text(L.report, ML);
        doc.font(R, 9).fillColor('#333').text(d.report.trim(), ML, doc.y + 2, { width: contentW });
      }

      doc.moveDown(0.3);
      hr('#dddddd', 0.8);
    }

    // Grand totals
    doc.moveDown(0.6);
    hr('#111111', 1.5);
    kv(L.totalAllocated, fmt(totalAllocated), { bold: true });
    kv(L.totalExpenses, fmt(totalSpent), { bold: true, color: '#b45309' });
    kv(L.totalBalance, fmt(totalAllocated - totalSpent), {
      bold: true, color: totalAllocated - totalSpent < 0 ? '#b91c1c' : '#15803d'
    });

    doc.end();
  });
}
