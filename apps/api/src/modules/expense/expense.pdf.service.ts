import PDFDocument from 'pdfkit';
import type { Locale } from '../../utils/translate.js';

type Line = { name: string; quantity?: number; unit?: string; amountSum: number };
type PdfEvent = {
  type: string;
  products: Line[];
  salaries: { name: string; amountSum: number }[];
  additionals: { name: string; amountSum: number }[];
};
export type PdfDay = {
  date: string;
  allocatedSum: number;
  report: string | null;
  events: PdfEvent[];
};

const EVENT_ORDER = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'];

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Expense Ledger', allocated: 'Allocated funds', products: 'Product expenses',
    salaries: 'Employee salaries', additional: 'Additional expenses', spent: 'Spent',
    balance: 'Balance', totalAllocated: 'Total Allocated Funds', totalExpenses: 'Total Expenses',
    totalBalance: 'Total Balance', period: 'Period', noData: 'No data for this period.', report: 'Report',
    dayTotals: 'Day totals', grandTotals: 'Overall totals',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Tui', OTHERS: 'Others'
  },
  ru: {
    title: 'Книга расходов', allocated: 'Выделено средств', products: 'Расходы на продукты',
    salaries: 'Зарплаты сотрудников', additional: 'Дополнительные расходы', spent: 'Потрачено',
    balance: 'Остаток', totalAllocated: 'Итого выделено средств', totalExpenses: 'Итого расходы',
    totalBalance: 'Итоговый баланс', period: 'Период', noData: 'Нет данных за этот период.', report: 'Отчёт',
    dayTotals: 'Итоги дня', grandTotals: 'Общие итоги',
    NAHOR: 'Нахор', FOTIHA: 'Фотиха', TUI: 'Той', OTHERS: 'Прочее'
  },
  uz: {
    title: 'Xarajatlar daftari', allocated: 'Ajratilgan mablag', products: 'Mahsulot xarajatlari',
    salaries: 'Xodimlar ish haqi', additional: 'Qoshimcha xarajatlar', spent: 'Sarflangan',
    balance: 'Qoldiq', totalAllocated: 'Jami ajratilgan mablag', totalExpenses: 'Jami xarajatlar',
    totalBalance: 'Yakuniy balans', period: 'Davr', noData: 'Bu davr uchun malumot yoq.', report: 'Hisobot',
    dayTotals: 'Kun yakuni', grandTotals: 'Umumiy yakun',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Toy', OTHERS: 'Boshqalar'
  }
};

const fmt = (sum: number) => sum.toLocaleString('ru-RU') + " so'm";
const eventSpent = (e: PdfEvent) =>
  e.products.reduce((s, p) => s + p.amountSum, 0) +
  e.salaries.reduce((s, p) => s + p.amountSum, 0) +
  e.additionals.reduce((s, p) => s + p.amountSum, 0);
const eventHasData = (e: PdfEvent) => e.products.length > 0 || e.salaries.length > 0 || e.additionals.length > 0;
const daySpent = (d: PdfDay) => d.events.reduce((s, e) => s + eventSpent(e), 0);
const sortedEvents = (d: PdfDay) => [...d.events].sort((a, b) => EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type));

function formatDate(date: string, locale: Locale): string {
  const loc = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  try {
    return new Intl.DateTimeFormat(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${date}T00:00:00Z`));
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
    const right = doc.page.width - 44;
    const contentW = right - ML;
    const eventLabel = (type: string) => L[type] ?? type;

    const hr = (color = '#cccccc', weight = 1) => {
      doc.moveTo(ML, doc.y).lineTo(right, doc.y).lineWidth(weight).strokeColor(color).stroke();
      doc.moveDown(0.5);
    };
    const kv = (label: string, value: string, opts: { bold?: boolean; color?: string } = {}) => {
      const y = doc.y;
      doc.font(opts.bold ? B : R, 10).fillColor(opts.color ?? '#222');
      doc.text(label, ML, y, { width: contentW * 0.6, lineBreak: false });
      doc.text(value, ML, y, { width: contentW, align: 'right', lineBreak: false });
      doc.moveDown(0.5);
    };
    const lineList = (heading: string, rows: { label: string; value: number }[]) => {
      if (!rows.length) return;
      doc.font(B, 10).fillColor('#444').text(heading, ML);
      doc.moveDown(0.3);
      for (const r of rows) kv(`   • ${r.label}`, fmt(r.value));
      doc.moveDown(0.1);
    };

    // Header
    doc.font(B, 20).fillColor('#111').text(L.title, ML, 44);
    doc.font(R, 10).fillColor('#666').text(`${L.period}: ${range.from} — ${range.to}`);

    if (days.length === 0) {
      doc.moveDown(1).font(R, 11).fillColor('#666').text(L.noData, ML);
      doc.end();
      return;
    }

    let grandAllocated = 0;
    let grandSpent = 0;

    days.forEach((day, di) => {
      const events = sortedEvents(day).filter(eventHasData);
      grandAllocated += day.allocatedSum;
      grandSpent += daySpent(day);

      // Each event department gets its own page.
      events.forEach((ev, ei) => {
        if (di > 0 || ei > 0) doc.addPage(); else doc.moveDown(1);
        doc.font(B, 13).fillColor('#111').text(`${formatDate(day.date, locale)}  ·  ${eventLabel(ev.type)}`, ML);
        doc.moveDown(0.2);
        hr('#999999', 1.2);

        lineList(L.products, ev.products.map((p) => ({ label: p.quantity ? `${p.name}  (${p.quantity} ${p.unit ?? ''})`.trimEnd() : p.name, value: p.amountSum })));
        lineList(L.salaries, ev.salaries.map((s) => ({ label: s.name, value: s.amountSum })));
        lineList(L.additional, ev.additionals.map((a) => ({ label: a.name, value: a.amountSum })));

        doc.moveDown(0.2);
        kv(`${eventLabel(ev.type)} — ${L.spent}`, fmt(eventSpent(ev)), { bold: true, color: '#b45309' });
      });

      // Day totals — per-event columns, then the day total.
      if (di > 0 || events.length > 0) doc.addPage(); else doc.moveDown(1);
      doc.font(B, 14).fillColor('#111').text(`${L.dayTotals} — ${formatDate(day.date, locale)}`, ML);
      doc.moveDown(0.2);
      hr('#999999', 1.2);
      for (const ev of sortedEvents(day)) {
        kv(eventLabel(ev.type), fmt(eventSpent(ev)));
      }
      doc.moveDown(0.2);
      hr('#dddddd', 0.8);
      kv(L.allocated, fmt(day.allocatedSum), { bold: true });
      kv(L.spent, fmt(daySpent(day)), { bold: true, color: '#b45309' });
      kv(L.balance, fmt(day.allocatedSum - daySpent(day)), { bold: true, color: day.allocatedSum - daySpent(day) < 0 ? '#b91c1c' : '#15803d' });

      if (day.report && day.report.trim()) {
        doc.moveDown(0.3);
        doc.font(B, 10).fillColor('#444').text(L.report, ML);
        doc.font(R, 9).fillColor('#333').text(day.report.trim(), ML, doc.y + 2, { width: contentW });
      }
    });

    // Overall totals across all days.
    doc.addPage();
    doc.font(B, 16).fillColor('#111').text(L.grandTotals, ML, 44);
    doc.moveDown(0.3);
    hr('#111111', 1.5);
    kv(L.totalAllocated, fmt(grandAllocated), { bold: true });
    kv(L.totalExpenses, fmt(grandSpent), { bold: true, color: '#b45309' });
    kv(L.totalBalance, fmt(grandAllocated - grandSpent), { bold: true, color: grandAllocated - grandSpent < 0 ? '#b91c1c' : '#15803d' });

    doc.end();
  });
}
