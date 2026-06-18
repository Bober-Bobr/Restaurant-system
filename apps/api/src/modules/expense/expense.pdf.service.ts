import PDFDocument from 'pdfkit';
import type { Locale } from '../../utils/translate.js';

type Line = { name: string; quantity?: number; unit?: string; amountSum: number };
type PdfEvent = {
  type: string;
  bookingName?: string | null;
  guestCount: number;
  pricePerGuestSum: number;
  report?: string | null;
  products: Line[];
  salaries: { name: string; amountSum: number }[];
  additionals: { name: string; amountSum: number }[];
};
export type PdfDay = {
  date: string;
  allocatedSum: number;
  report: string | null;
  events: PdfEvent[];
  extras: { name: string; amountSum: number }[];
};

const EVENT_ORDER = ['NAHOR', 'FOTIHA', 'TUI', 'OTHERS'];

const LABELS: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Expense Ledger', summaryTitle: 'Expenses summary', allocated: 'Allocated funds', products: 'Product expenses',
    salaries: 'Employee salaries', additional: 'Additional expenses', spent: 'Spent',
    balance: 'Balance', totalAllocated: 'Total Allocated Funds', totalExpenses: 'Total Expenses',
    totalBalance: 'Total Balance', period: 'Period', noData: 'No data for this period.', report: 'Report',
    dayTotals: 'Day totals', grandTotals: 'Overall totals',
    booking: 'Booking', guests: 'Guests', pricePerGuest: 'Price per guest', bookingTotal: 'Booking total',
    extrasTitle: 'Additional expenses', total: 'Total', noExtras: 'No additional expenses.',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Tui', OTHERS: 'Others'
  },
  ru: {
    title: 'Книга расходов', summaryTitle: 'Сводка расходов', allocated: 'Выделено средств', products: 'Расходы на продукты',
    salaries: 'Зарплаты сотрудников', additional: 'Дополнительные расходы', spent: 'Потрачено',
    balance: 'Остаток', totalAllocated: 'Итого выделено средств', totalExpenses: 'Итого расходы',
    totalBalance: 'Итоговый баланс', period: 'Период', noData: 'Нет данных за этот период.', report: 'Отчёт',
    dayTotals: 'Итоги дня', grandTotals: 'Общие итоги',
    booking: 'Бронь', guests: 'Гостей', pricePerGuest: 'Цена за гостя', bookingTotal: 'Итого по брони',
    extrasTitle: 'Дополнительные расходы', total: 'Итого', noExtras: 'Нет дополнительных расходов.',
    NAHOR: 'Нахор', FOTIHA: 'Фотиха', TUI: 'Той', OTHERS: 'Прочее'
  },
  uz: {
    title: 'Xarajatlar daftari', summaryTitle: 'Xarajatlar hisoboti', allocated: 'Ajratilgan mablag', products: 'Mahsulot xarajatlari',
    salaries: 'Xodimlar ish haqi', additional: 'Qoshimcha xarajatlar', spent: 'Sarflangan',
    balance: 'Qoldiq', totalAllocated: 'Jami ajratilgan mablag', totalExpenses: 'Jami xarajatlar',
    totalBalance: 'Yakuniy balans', period: 'Davr', noData: 'Bu davr uchun malumot yoq.', report: 'Hisobot',
    dayTotals: 'Kun yakuni', grandTotals: 'Umumiy yakun',
    booking: 'Bron', guests: 'Mehmonlar', pricePerGuest: 'Mehmon narxi', bookingTotal: 'Bron jami',
    extrasTitle: 'Qoshimcha xarajatlar', total: 'Jami', noExtras: 'Qoshimcha xarajatlar yoq.',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Toy', OTHERS: 'Boshqalar'
  }
};

const fmt = (sum: number) => sum.toLocaleString('ru-RU') + " so'm";
const bookingTotal = (e: PdfEvent) => e.guestCount * e.pricePerGuestSum;
const eventSpent = (e: PdfEvent) =>
  bookingTotal(e) +
  e.products.reduce((s, p) => s + p.amountSum, 0) +
  e.salaries.reduce((s, p) => s + p.amountSum, 0) +
  e.additionals.reduce((s, p) => s + p.amountSum, 0);
const eventHasData = (e: PdfEvent) =>
  e.products.length > 0 || e.salaries.length > 0 || e.additionals.length > 0 ||
  bookingTotal(e) > 0 || !!e.bookingName?.trim() || !!e.report?.trim();
const daySpent = (d: PdfDay) => d.events.reduce((s, e) => s + eventSpent(e), 0);
const dayExtrasTotal = (d: PdfDay) => d.extras.reduce((s, e) => s + e.amountSum, 0);
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

// A PDFKit document plus the shared drawing helpers and a finalize() promise.
function createDoc(locale: Locale) {
  const L = LABELS[locale] ?? LABELS.en;
  const doc = new PDFDocument({ margin: 44, size: 'A4', bufferPages: true });
  const buffers: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);
  });

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

  return { doc, finished, L, R, B, ML, right, contentW, eventLabel, hr, kv, lineList };
}

type Ctx = ReturnType<typeof createDoc>;

// One event department's full detail (booking, line items, spent, notes).
function renderEventDetail(ctx: Ctx, day: PdfDay, ev: PdfEvent, locale: Locale) {
  const { doc, L, R, B, ML, contentW, eventLabel, hr, kv, lineList } = ctx;
  doc.font(B, 13).fillColor('#111').text(`${formatDate(day.date, locale)}  ·  ${eventLabel(ev.type)}`, ML);
  doc.moveDown(0.2);
  hr('#999999', 1.2);

  if (ev.bookingName?.trim() || bookingTotal(ev) > 0) {
    doc.font(B, 10).fillColor('#444').text(L.booking, ML);
    doc.moveDown(0.3);
    if (ev.bookingName?.trim()) kv('   • ' + L.booking, ev.bookingName.trim());
    kv(`   • ${L.guests} × ${L.pricePerGuest}`, `${ev.guestCount} × ${fmt(ev.pricePerGuestSum)}`);
    kv(`   • ${L.bookingTotal}`, fmt(bookingTotal(ev)));
    doc.moveDown(0.1);
  }

  lineList(L.products, ev.products.map((p) => ({ label: p.quantity ? `${p.name}  (${p.quantity} ${p.unit ?? ''})`.trimEnd() : p.name, value: p.amountSum })));
  lineList(L.salaries, ev.salaries.map((s) => ({ label: s.name, value: s.amountSum })));
  lineList(L.additional, ev.additionals.map((a) => ({ label: a.name, value: a.amountSum })));

  doc.moveDown(0.2);
  kv(`${eventLabel(ev.type)} — ${L.spent}`, fmt(eventSpent(ev)), { bold: true, color: '#b45309' });

  if (ev.report?.trim()) {
    doc.moveDown(0.3);
    doc.font(B, 10).fillColor('#444').text(L.report, ML);
    doc.font(R, 9).fillColor('#333').text(ev.report.trim(), ML, doc.y + 2, { width: contentW });
  }
}

// Per-event columns + allocated/spent/balance + the day report.
function renderDayTotals(ctx: Ctx, day: PdfDay, locale: Locale) {
  const { doc, L, R, B, ML, contentW, eventLabel, hr, kv } = ctx;
  doc.font(B, 14).fillColor('#111').text(`${L.dayTotals} — ${formatDate(day.date, locale)}`, ML);
  doc.moveDown(0.2);
  hr('#999999', 1.2);
  for (const ev of sortedEvents(day)) kv(eventLabel(ev.type), fmt(eventSpent(ev)));
  doc.moveDown(0.2);
  hr('#dddddd', 0.8);
  const balance = day.allocatedSum - daySpent(day);
  kv(L.allocated, fmt(day.allocatedSum), { bold: true });
  kv(L.spent, fmt(daySpent(day)), { bold: true, color: '#b45309' });
  kv(L.balance, fmt(balance), { bold: true, color: balance < 0 ? '#b91c1c' : '#15803d' });

  if (day.report && day.report.trim()) {
    doc.moveDown(0.3);
    doc.font(B, 10).fillColor('#444').text(L.report, ML);
    doc.font(R, 9).fillColor('#333').text(day.report.trim(), ML, doc.y + 2, { width: contentW });
  }
}

// Overview page: per-day rows (events with a spend, then allocated/spent/balance)
// followed by the overall grand totals. Used as the cover page for multi-day PDFs.
function renderSummaryPage(ctx: Ctx, days: PdfDay[], range: { from: string; to: string }, locale: Locale) {
  const { doc, L, B, R, ML, eventLabel, hr, kv } = ctx;
  doc.font(B, 20).fillColor('#111').text(L.summaryTitle, ML, 44);
  doc.font(R, 10).fillColor('#666').text(`${L.period}: ${range.from} — ${range.to}`);
  doc.moveDown(0.6);

  let grandAllocated = 0;
  let grandSpent = 0;
  days.forEach((day) => {
    grandAllocated += day.allocatedSum;
    grandSpent += daySpent(day);
    if (doc.y > doc.page.height - 150) doc.addPage();

    doc.font(B, 12).fillColor('#111').text(formatDate(day.date, locale), ML);
    doc.moveDown(0.2);
    hr('#bbbbbb', 1);
    for (const ev of sortedEvents(day)) {
      const s = eventSpent(ev);
      if (s > 0) kv(`   ${eventLabel(ev.type)}`, fmt(s));
    }
    const balance = day.allocatedSum - daySpent(day);
    kv(L.allocated, fmt(day.allocatedSum), { bold: true });
    kv(L.spent, fmt(daySpent(day)), { bold: true, color: '#b45309' });
    kv(L.balance, fmt(balance), { bold: true, color: balance < 0 ? '#b91c1c' : '#15803d' });
    doc.moveDown(0.6);
  });

  if (doc.y > doc.page.height - 150) doc.addPage(); else doc.moveDown(0.4);
  doc.font(B, 16).fillColor('#111').text(L.grandTotals, ML);
  doc.moveDown(0.3);
  hr('#111111', 1.5);
  kv(L.totalAllocated, fmt(grandAllocated), { bold: true });
  kv(L.totalExpenses, fmt(grandSpent), { bold: true, color: '#b45309' });
  kv(L.totalBalance, fmt(grandAllocated - grandSpent), { bold: true, color: grandAllocated - grandSpent < 0 ? '#b91c1c' : '#15803d' });
}

// Single combined PDF for the selected main expenses. For several days the first
// page is the overall summary (invoice overview); each day then leads with its
// own totals/invoice page, followed by one page per event department.
export function generateCombinedPdf(days: PdfDay[], range: { from: string; to: string }, locale: Locale): Promise<Buffer> {
  const ctx = createDoc(locale);
  const { doc, L, R, B, ML } = ctx;

  if (days.length === 0) {
    doc.font(B, 20).fillColor('#111').text(L.title, ML, 44);
    doc.moveDown(1).font(R, 11).fillColor('#666').text(L.noData, ML);
    doc.end();
    return ctx.finished;
  }

  const multi = days.length > 1;
  if (multi) renderSummaryPage(ctx, days, range, locale);

  days.forEach((day, di) => {
    if (multi || di > 0) doc.addPage(); else doc.moveDown(0.5);
    renderDayTotals(ctx, day, locale); // the day's invoice/totals leads its section
    for (const ev of sortedEvents(day).filter(eventHasData)) {
      doc.addPage();
      renderEventDetail(ctx, day, ev, locale);
    }
  });

  doc.end();
  return ctx.finished;
}

// Single combined PDF for the day-level additional expenses (kept separate from
// the main expenses). One page per day; a cover summary page for several days.
export function generateExtrasPdf(days: PdfDay[], range: { from: string; to: string }, locale: Locale): Promise<Buffer> {
  const ctx = createDoc(locale);
  const { doc, L, R, B, ML, hr, kv } = ctx;

  doc.font(B, 20).fillColor('#111').text(L.extrasTitle, ML, 44);
  doc.font(R, 10).fillColor('#666').text(`${L.period}: ${range.from} — ${range.to}`);
  doc.moveDown(0.6);

  if (days.length === 0) {
    doc.font(R, 11).fillColor('#666').text(L.noData, ML);
    doc.end();
    return ctx.finished;
  }

  const multi = days.length > 1;
  let grand = 0;

  if (multi) {
    // Cover summary: per-day totals + grand total.
    days.forEach((day) => {
      grand += dayExtrasTotal(day);
      if (doc.y > doc.page.height - 120) doc.addPage();
      kv(formatDate(day.date, locale), fmt(dayExtrasTotal(day)));
    });
    doc.moveDown(0.3);
    hr('#111111', 1.5);
    kv(L.total, fmt(grand), { bold: true, color: '#b45309' });
  }

  days.forEach((day, di) => {
    if (multi || di > 0) doc.addPage(); else doc.moveDown(0.5);
    doc.font(B, 14).fillColor('#111').text(`${formatDate(day.date, locale)} — ${L.extrasTitle}`, ML);
    doc.moveDown(0.2);
    hr('#999999', 1.2);
    if (day.extras.length === 0) {
      doc.font(R, 10).fillColor('#666').text(L.noExtras, ML);
      return;
    }
    for (const ex of day.extras) kv(`   • ${ex.name}`, fmt(ex.amountSum));
    doc.moveDown(0.2);
    hr('#dddddd', 0.8);
    kv(L.total, fmt(dayExtrasTotal(day)), { bold: true, color: '#b45309' });
  });

  doc.end();
  return ctx.finished;
}
