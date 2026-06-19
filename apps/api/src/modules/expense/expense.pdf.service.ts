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
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Wedding', OTHERS: 'Others'
  },
  ru: {
    title: 'Книга расходов', summaryTitle: 'Сводка расходов', allocated: 'Выделено средств', products: 'Расходы на продукты',
    salaries: 'Зарплаты сотрудников', additional: 'Дополнительные расходы', spent: 'Потрачено',
    balance: 'Остаток', totalAllocated: 'Итого выделено средств', totalExpenses: 'Итого расходы',
    totalBalance: 'Итоговый баланс', period: 'Период', noData: 'Нет данных за этот период.', report: 'Отчёт',
    dayTotals: 'Итоги дня', grandTotals: 'Общие итоги',
    booking: 'Бронь', guests: 'Гостей', pricePerGuest: 'Цена за гостя', bookingTotal: 'Итого по брони',
    extrasTitle: 'Дополнительные расходы', total: 'Итого', noExtras: 'Нет дополнительных расходов.',
    NAHOR: 'Нахор', FOTIHA: 'Фотиха', TUI: 'Свадьба', OTHERS: 'Прочее'
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
  const kv = (label: string, value: string, opts: { bold?: boolean; color?: string; labelColor?: string; size?: number } = {}) => {
    const y = doc.y;
    const size = opts.size ?? 10;
    doc.font(opts.bold ? B : R, size).fillColor(opts.labelColor ?? '#222');
    doc.text(label, ML, y, { width: contentW * 0.62, lineBreak: false });
    doc.font(opts.bold ? B : R, size).fillColor(opts.color ?? opts.labelColor ?? '#222');
    doc.text(value, ML, y, { width: contentW, align: 'right', lineBreak: false });
    doc.moveDown(0.55);
  };
  // A flat bulleted "• name … amount" line, photo-style.
  const bulletRow = (name: string, value: number) => kv(`•  ${name}`, fmt(value));

  return { doc, finished, L, R, B, ML, right, contentW, eventLabel, hr, kv, bulletRow };
}

type Ctx = ReturnType<typeof createDoc>;

// One event department's full detail on its own page, photo-style: a flat
// bulleted list of every line, an "Additional expenses" group, then the
// Spent / Balance footer in red/green.
function renderEventDetail(ctx: Ctx, day: PdfDay, ev: PdfEvent, locale: Locale) {
  const { doc, L, R, B, ML, contentW, eventLabel, hr, kv, bulletRow } = ctx;
  doc.font(B, 15).fillColor('#111').text(`${formatDate(day.date, locale)}  ·  ${eventLabel(ev.type)}`, ML, 44);
  doc.moveDown(0.3);
  hr('#999999', 1.2);
  doc.moveDown(0.2);

  // Flat list: booking line, products (with qty/unit), salaries.
  if (bookingTotal(ev) > 0) {
    const name = ev.bookingName?.trim() || L.booking;
    kv(`•  ${name}  (${ev.guestCount} × ${fmt(ev.pricePerGuestSum)})`, fmt(bookingTotal(ev)));
  } else if (ev.bookingName?.trim()) {
    kv(`•  ${ev.bookingName.trim()}`, '');
  }
  for (const p of ev.products) {
    const label = p.quantity ? `•  ${p.name}  (${p.quantity} ${p.unit ?? ''})`.trimEnd() : `•  ${p.name}`;
    kv(label, fmt(p.amountSum));
  }
  for (const s of ev.salaries) bulletRow(s.name, s.amountSum);

  // Additional expenses group.
  if (ev.additionals.length) {
    doc.moveDown(0.4);
    doc.font(B, 11).fillColor('#222').text(L.additional, ML);
    doc.moveDown(0.4);
    for (const a of ev.additionals) bulletRow(a.name, a.amountSum);
  }

  // Spent / balance footer. Balance here is allocated minus this department's
  // spend is not meaningful, so only the department's own Spent is shown.
  doc.moveDown(0.6);
  hr('#dddddd', 0.8);
  doc.moveDown(0.1);
  kv(L.spent, fmt(eventSpent(ev)), { bold: true, color: '#b91c1c', labelColor: '#b91c1c', size: 11 });

  if (ev.report?.trim()) {
    doc.moveDown(0.4);
    doc.font(B, 10).fillColor('#444').text(L.report, ML);
    doc.font(R, 9).fillColor('#333').text(ev.report.trim(), ML, doc.y + 2, { width: contentW });
  }
}

// The day's summary page, photo-style: each department's spend as a bulleted
// line, then the Spent / Balance footer and the grand
// Total Allocated / Total Expenses / Total Balance block (red / green).
function renderDayTotals(ctx: Ctx, day: PdfDay, locale: Locale) {
  const { doc, L, R, B, ML, contentW, eventLabel, hr, kv, bulletRow } = ctx;
  doc.font(B, 16).fillColor('#111').text(`${L.dayTotals} — ${formatDate(day.date, locale)}`, ML, 44);
  doc.moveDown(0.3);
  hr('#999999', 1.2);
  doc.moveDown(0.2);

  for (const ev of sortedEvents(day)) bulletRow(eventLabel(ev.type), eventSpent(ev));

  // Day-level additional expenses, if any.
  if (day.extras.length) {
    doc.moveDown(0.4);
    doc.font(B, 11).fillColor('#222').text(L.additional, ML);
    doc.moveDown(0.4);
    for (const ex of day.extras) bulletRow(ex.name, ex.amountSum);
  }

  const spent = daySpent(day);
  const balance = day.allocatedSum - spent;
  const green = '#15803d';
  const red = '#b91c1c';

  doc.moveDown(0.6);
  hr('#dddddd', 0.8);
  doc.moveDown(0.1);
  kv(L.spent, fmt(spent), { bold: true, color: red, labelColor: red, size: 11 });
  kv(L.balance, fmt(balance), { bold: true, color: balance < 0 ? red : green, labelColor: balance < 0 ? red : green, size: 11 });

  doc.moveDown(0.3);
  hr('#111111', 1.4);
  doc.moveDown(0.1);
  kv(L.totalAllocated, fmt(day.allocatedSum), { bold: true, size: 11 });
  kv(L.totalExpenses, fmt(spent), { bold: true, color: red, labelColor: red, size: 11 });
  kv(L.totalBalance, fmt(balance), { bold: true, color: balance < 0 ? red : green, labelColor: balance < 0 ? red : green, size: 11 });

  if (day.report && day.report.trim()) {
    doc.moveDown(0.5);
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
    kv(L.spent, fmt(daySpent(day)), { bold: true, color: '#b91c1c', labelColor: '#b91c1c' });
    kv(L.balance, fmt(balance), { bold: true, color: balance < 0 ? '#b91c1c' : '#15803d', labelColor: balance < 0 ? '#b91c1c' : '#15803d' });
    doc.moveDown(0.6);
  });

  if (doc.y > doc.page.height - 150) doc.addPage(); else doc.moveDown(0.4);
  doc.font(B, 16).fillColor('#111').text(L.grandTotals, ML);
  doc.moveDown(0.3);
  hr('#111111', 1.5);
  const grandBalance = grandAllocated - grandSpent;
  kv(L.totalAllocated, fmt(grandAllocated), { bold: true });
  kv(L.totalExpenses, fmt(grandSpent), { bold: true, color: '#b91c1c', labelColor: '#b91c1c' });
  kv(L.totalBalance, fmt(grandBalance), { bold: true, color: grandBalance < 0 ? '#b91c1c' : '#15803d', labelColor: grandBalance < 0 ? '#b91c1c' : '#15803d' });
}

// Single combined PDF for the selected main expenses. Page order: for each day,
// one page per event department followed by that day's summary page; after all
// days (when more than one) a final overall summary page closes the document.
export function generateCombinedPdf(days: PdfDay[], range: { from: string; to: string }, locale: Locale): Promise<Buffer> {
  const ctx = createDoc(locale);
  const { doc, L, R, B, ML } = ctx;

  if (days.length === 0) {
    doc.font(B, 20).fillColor('#111').text(L.title, ML, 44);
    doc.moveDown(1).font(R, 11).fillColor('#666').text(L.noData, ML);
    doc.end();
    return ctx.finished;
  }

  // The document opens on a blank first page; reuse it for the first section,
  // then add a fresh page before every subsequent one.
  let started = false;
  const newPage = () => { if (started) doc.addPage(); started = true; };

  days.forEach((day) => {
    for (const ev of sortedEvents(day).filter(eventHasData)) {
      newPage();
      renderEventDetail(ctx, day, ev, locale);
    }
    newPage();
    renderDayTotals(ctx, day, locale); // the day's summary closes its section
  });

  if (days.length > 1) {
    newPage();
    renderSummaryPage(ctx, days, range, locale); // overall summary, last
  }

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
