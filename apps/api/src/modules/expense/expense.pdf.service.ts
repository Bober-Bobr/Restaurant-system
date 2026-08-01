import PDFDocument from 'pdfkit';
import type { Locale } from '../../utils/translate.js';

type Line = { name: string; quantity?: number; unit?: string; amountSum: number };
type PdfEvent = {
  type: string;
  bookingName?: string | null;
  guestCount: number;
  pricePerGuestSum: number;
  report?: string | null;
  // When set, this replaces guests x price per guest as the guest revenue.
  manualGuestsSum?: number | null;
  products: Line[];
  salaries: { name: string; amountSum: number }[];
  additionals: { name: string; amountSum: number }[];
  services: { name: string; amountSum: number }[];
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
    title: 'Expense Ledger', summaryTitle: 'Expenses summary', allocated: 'Allocated funds', revenue: 'Revenue', products: 'Product expenses',
    salaries: 'Employee salaries', additional: 'Additional expenses', services: 'Additional services', spent: 'Spent',
    balance: 'Balance', totalAllocated: 'Total revenue', totalExpenses: 'Total Expenses',
    totalBalance: 'Total Balance', period: 'Period', noData: 'No data for this period.', report: 'Report',
    dayTotals: 'Day totals', eventTotals: 'Department totals', grandTotals: 'Overall totals', manualNote: 'Entered manually', computedNote: 'Guests x price per guest',
    booking: 'Booking', guests: 'Guests', pricePerGuest: 'Price per guest', guestsRevenue: 'Revenue for all guests',
    servicesRevenue: 'Additional services (revenue)', totalRevenue: 'Total revenue',
    name: 'Name', amount: 'Amount', date: 'Date', department: 'Department',
    extrasTitle: 'Additional expenses', total: 'Total', sectionTotal: 'Section total', noExtras: 'No additional expenses.',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Wedding', OTHERS: 'Others'
  },
  ru: {
    title: 'Книга расходов', summaryTitle: 'Сводка расходов', allocated: 'Выделено средств', revenue: 'Доход', products: 'Расходы на продукты',
    salaries: 'Зарплаты сотрудников', additional: 'Дополнительные расходы', services: 'Дополнительные услуги', spent: 'Потрачено',
    balance: 'Остаток', totalAllocated: 'Итого доход', totalExpenses: 'Итого расходы',
    totalBalance: 'Итоговый баланс', period: 'Период', noData: 'Нет данных за этот период.', report: 'Отчёт',
    dayTotals: 'Итоги дня', eventTotals: 'Итоги отдела', grandTotals: 'Общие итоги', manualNote: 'Введено вручную', computedNote: 'Гости x цена за гостя',
    booking: 'Бронь', guests: 'Гостей', pricePerGuest: 'Цена за гостя', guestsRevenue: 'Доход со всех гостей',
    servicesRevenue: 'Дополнительные услуги (доход)', totalRevenue: 'Итого доход',
    name: 'Наименование', amount: 'Сумма', date: 'Дата', department: 'Отдел',
    extrasTitle: 'Дополнительные расходы', total: 'Итого', sectionTotal: 'Итого по разделу', noExtras: 'Нет дополнительных расходов.',
    NAHOR: 'Нахор', FOTIHA: 'Фотиха', TUI: 'Свадьба', OTHERS: 'Прочее'
  },
  uz: {
    title: 'Xarajatlar daftari', summaryTitle: 'Xarajatlar hisoboti', allocated: 'Ajratilgan mablag', revenue: 'Daromad', products: 'Mahsulot xarajatlari',
    salaries: 'Xodimlar ish haqi', additional: 'Qoshimcha xarajatlar', services: 'Qoshimcha xizmatlar', spent: 'Sarflangan',
    balance: 'Qoldiq', totalAllocated: 'Jami daromad', totalExpenses: 'Jami xarajatlar',
    totalBalance: 'Yakuniy balans', period: 'Davr', noData: 'Bu davr uchun malumot yoq.', report: 'Hisobot',
    dayTotals: 'Kun yakuni', eventTotals: 'Bolim yakuni', grandTotals: 'Umumiy yakun', manualNote: 'Qolda kiritilgan', computedNote: 'Mehmonlar x mehmon narxi',
    booking: 'Bron', guests: 'Mehmonlar', pricePerGuest: 'Mehmon narxi', guestsRevenue: 'Barcha mehmonlardan daromad',
    servicesRevenue: 'Qoshimcha xizmatlar (daromad)', totalRevenue: 'Jami daromad',
    name: 'Nomi', amount: 'Summa', date: 'Sana', department: 'Bolim',
    extrasTitle: 'Qoshimcha xarajatlar', total: 'Jami', sectionTotal: 'Bolim jami', noExtras: 'Qoshimcha xarajatlar yoq.',
    NAHOR: 'Nahor', FOTIHA: 'Fotiha', TUI: 'Toy', OTHERS: 'Boshqalar'
  }
};

const fmt = (sum: number) => sum.toLocaleString('ru-RU') + " so'm";
const sumLines = (lines: { amountSum: number }[]) => lines.reduce((s, l) => s + l.amountSum, 0);

// ── Revenue ──
// Guest revenue is guests × price per guest, unless a manual figure was entered
// for the department, which wins outright.
const computedGuests = (e: PdfEvent) => e.guestCount * e.pricePerGuestSum;
const guestsRevenue = (e: PdfEvent) =>
  (e.manualGuestsSum != null ? e.manualGuestsSum : computedGuests(e));
// Additional services are SOLD, so they are revenue too and add to the
// department total. They are deliberately not part of the manual override —
// overriding the guest figure must not silently drop them.
const servicesRevenue = (e: PdfEvent) => sumLines(e.services);
const eventRevenue = (e: PdfEvent) => guestsRevenue(e) + servicesRevenue(e);

// ── Spending ──
// Products, salaries and additional expenses only. Services are revenue.
const eventSpent = (e: PdfEvent) =>
  sumLines(e.products) + sumLines(e.salaries) + sumLines(e.additionals);

const eventHasData = (e: PdfEvent) =>
  e.products.length > 0 || e.salaries.length > 0 || e.additionals.length > 0 || e.services.length > 0 ||
  computedGuests(e) > 0 || e.manualGuestsSum != null || !!e.bookingName?.trim() || !!e.report?.trim();
const daySpent = (d: PdfDay) => d.events.reduce((s, e) => s + eventSpent(e), 0);
const dayRevenue = (d: PdfDay) => d.events.reduce((s, e) => s + eventRevenue(e), 0);
const dayExtrasTotal = (d: PdfDay) => d.extras.reduce((s, e) => s + e.amountSum, 0);
const sortedEvents = (d: PdfDay) => [...d.events].sort((a, b) => EVENT_ORDER.indexOf(a.type) - EVENT_ORDER.indexOf(b.type));

const GREEN = '#15803d';
const RED = '#b91c1c';

function formatDate(date: string, locale: Locale): string {
  const loc = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
  try {
    return new Intl.DateTimeFormat(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

// A PDFKit document plus the bordered-table helpers shared with the banquet
// event PDF (apps/api/src/modules/public/pdf.service.ts): same margins, column
// split, row heights, greys and section bands, so the two files look alike.
function createDoc(locale: Locale) {
  const L = LABELS[locale] ?? LABELS.en;
  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
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

  const ML = 40;
  const PH = doc.page.height;
  const TW = doc.page.width - ML * 2;
  const COL1 = TW * 0.78;
  const COL2 = TW * 0.22;
  const ROW_H = 18;
  const SECTION_H = 20;
  const HEADER_H = 22;

  // curY is owned by these helpers. Every one of them calls ensureSpace() before
  // drawing, so a page break always happens *before* the cell is placed rather
  // than leaving it half off the page.
  const state = { y: ML };

  const ensureSpace = (needed: number) => {
    if (state.y + needed > PH - 50) {
      doc.addPage();
      state.y = ML;
    }
  };

  const cell = (x: number, y: number, w: number, h: number, text: string, opts: {
    fontSize?: number; align?: 'left' | 'center' | 'right';
    bold?: boolean; fillColor?: string; textColor?: string; paddingLeft?: number;
  } = {}) => {
    const {
      fontSize = 9, align = 'left',
      fillColor = '#ffffff', textColor = '#000000', paddingLeft = 4,
    } = opts;
    doc.save();
    doc.rect(x, y, w, h).fillColor(fillColor).fill();
    doc.rect(x, y, w, h).lineWidth(0.5).strokeColor('#000000').stroke();
    doc.fillColor(textColor).font(opts.bold ? B : R, fontSize)
      .text(text, x + paddingLeft, y + (h - fontSize * 1.1) / 2 + 1, {
        width: w - paddingLeft * 2, align, lineBreak: false, ellipsis: true,
      });
    doc.restore();
  };

  const tableHeader = (label1: string, label2: string) => {
    ensureSpace(HEADER_H);
    cell(ML, state.y, COL1, HEADER_H, label1, { bold: true, fillColor: '#f0f0f0', align: 'center' });
    cell(ML + COL1, state.y, COL2, HEADER_H, label2, { bold: true, fillColor: '#f0f0f0', align: 'center' });
    state.y += HEADER_H;
  };

  // Full-width band naming the section that follows.
  const sectionRow = (label: string) => {
    ensureSpace(SECTION_H);
    cell(ML, state.y, TW, SECTION_H, label, { bold: true, align: 'center', fillColor: '#e8e8e8' });
    state.y += SECTION_H;
  };

  const dataRow = (name: string, value: string, shade = false) => {
    ensureSpace(ROW_H);
    const fillColor = shade ? '#fafafa' : '#ffffff';
    cell(ML, state.y, COL1, ROW_H, name, { fillColor });
    cell(ML + COL1, state.y, COL2, ROW_H, value, { align: 'center', fillColor });
    state.y += ROW_H;
  };

  // Bold, slightly taller row closing a section or the document.
  const totalRow = (label: string, value: string, color = '#000000') => {
    ensureSpace(ROW_H + 4);
    cell(ML, state.y, COL1, ROW_H + 4, label, { bold: true, fontSize: 10, fillColor: '#f0f0f0', textColor: color });
    cell(ML + COL1, state.y, COL2, ROW_H + 4, value, { bold: true, fontSize: 10, align: 'center', fillColor: '#f0f0f0', textColor: color });
    state.y += ROW_H + 4;
  };

  // A named section with its own lines and its own closing total. Empty sections
  // are skipped entirely rather than printing a heading over nothing.
  const section = (label: string, lines: { label: string; value: number }[], totalLabel: string) => {
    if (lines.length === 0) return 0;
    sectionRow(label.toUpperCase());
    let shade = false;
    for (const line of lines) {
      dataRow(line.label, fmt(line.value), shade);
      shade = !shade;
    }
    const total = lines.reduce((s, l) => s + l.value, 0);
    totalRow(`${totalLabel} — ${label}`, fmt(total));
    return total;
  };

  const heading = (title: string, subtitle?: string) => {
    doc.font(B, 14).fillColor('#000000').text(title, ML, state.y, { width: TW, align: 'center' });
    state.y += 20;
    if (subtitle) {
      doc.font(R, 10).fillColor('#555555').text(subtitle, ML, state.y, { width: TW, align: 'center' });
      state.y += 16;
    }
    state.y += 6;
  };

  // Two label/value pairs per line, above the table — same block as the banquet PDF.
  const infoRows = (rows: [string, string, string, string][]) => {
    const halfW = TW / 2 - 4;
    for (const [lbl1, val1, lbl2, val2] of rows) {
      ensureSpace(16);
      doc.font(B, 8).fillColor('#555').text(lbl1, ML, state.y + 1, { width: 80, lineBreak: false });
      doc.font(R, 9).fillColor('#000').text(val1, ML + 82, state.y + 1, { width: halfW - 82, lineBreak: false });
      doc.font(B, 8).fillColor('#555').text(lbl2, ML + halfW + 8, state.y + 1, { width: 80, lineBreak: false });
      doc.font(R, 9).fillColor('#000').text(val2, ML + halfW + 90, state.y + 1, { width: halfW - 90, lineBreak: false });
      state.y += 14;
    }
    state.y += 8;
  };

  const note = (label: string, text: string) => {
    ensureSpace(40);
    state.y += 10;
    doc.font(B, 9).fillColor('#444').text(label, ML, state.y, { width: TW });
    state.y += 13;
    doc.font(R, 9).fillColor('#333').text(text, ML, state.y, { width: TW });
    state.y = doc.y + 4;
  };

  const newPage = () => { doc.addPage(); state.y = ML; };
  const eventLabel = (type: string) => L[type] ?? type;

  return {
    doc, finished, L, R, B, ML, TW, state, eventLabel,
    ensureSpace, tableHeader, sectionRow, dataRow, totalRow, section, heading, infoRows, note, newPage,
  };
}

type Ctx = ReturnType<typeof createDoc>;

// One department's full detail on its own page: booking, then a table with a
// section per expense type, each closed by its own total, then budget/spent/balance.
function renderEventDetail(ctx: Ctx, day: PdfDay, ev: PdfEvent, locale: Locale) {
  const { L, eventLabel, tableHeader, dataRow, totalRow, section, heading, infoRows, note } = ctx;

  heading(`${eventLabel(ev.type)}`, formatDate(day.date, locale));
  infoRows([
    [`${L.department}:`, eventLabel(ev.type), `${L.date}:`, day.date],
    [`${L.booking}:`, ev.bookingName?.trim() || '—', `${L.guests}:`, String(ev.guestCount)],
    [`${L.pricePerGuest}:`, fmt(ev.pricePerGuestSum), `${L.guestsRevenue}:`, fmt(guestsRevenue(ev))],
  ]);

  tableHeader(L.name, L.amount);

  // Revenue side first: additional services are sold, so they belong here and
  // not among the expense sections below.
  section(L.services, ev.services.map((s) => ({ label: s.name, value: s.amountSum })), L.sectionTotal);

  section(
    L.products,
    ev.products.map((p) => ({
      label: p.quantity ? `${p.name} (${p.quantity} ${p.unit ?? ''})`.trimEnd() : p.name,
      value: p.amountSum,
    })),
    L.sectionTotal,
  );
  section(L.salaries, ev.salaries.map((s) => ({ label: s.name, value: s.amountSum })), L.sectionTotal);
  section(L.additional, ev.additionals.map((a) => ({ label: a.name, value: a.amountSum })), L.sectionTotal);

  // Closing totals for the department: the revenue is built up line by line so
  // the reader can see where the department total came from, then spending and
  // the balance.
  const revenue = eventRevenue(ev);
  const spent = eventSpent(ev);
  const balance = revenue - spent;
  ctx.sectionRow(L.eventTotals.toUpperCase());

  // When the guest figure was typed in by hand, guests × price is still shown,
  // so the reader can see what was overridden rather than just a number that
  // disagrees with the guest count and price above it.
  if (ev.manualGuestsSum != null) {
    dataRow(`${L.guestsRevenue} (${L.computedNote.toLowerCase()})`, fmt(computedGuests(ev)), false);
    dataRow(`${L.guestsRevenue} — ${L.manualNote}`, fmt(guestsRevenue(ev)), true);
  } else {
    dataRow(L.guestsRevenue, fmt(guestsRevenue(ev)), false);
  }
  // Only worth a line when there is something to add.
  if (servicesRevenue(ev) > 0) dataRow(L.servicesRevenue, fmt(servicesRevenue(ev)), true);
  totalRow(L.totalRevenue, fmt(revenue), GREEN);
  totalRow(L.spent, fmt(spent), RED);
  totalRow(L.balance, fmt(balance), balance < 0 ? RED : GREEN);

  if (ev.report?.trim()) note(L.report, ev.report.trim());
}

// Overview page: one section per day listing its departments, then grand totals.
function renderSummaryPage(ctx: Ctx, days: PdfDay[], range: { from: string; to: string }, locale: Locale) {
  const { L, eventLabel, tableHeader, dataRow, totalRow, section, heading } = ctx;

  heading(L.summaryTitle, `${L.period}: ${range.from} — ${range.to}`);
  tableHeader(L.name, L.amount);

  let grandRevenue = 0;
  let grandSpent = 0;
  for (const day of days) {
    grandRevenue += dayRevenue(day);
    grandSpent += daySpent(day);

    const rows = sortedEvents(day)
      .filter((ev) => eventSpent(ev) > 0)
      .map((ev) => ({ label: eventLabel(ev.type), value: eventSpent(ev) }));
    // A day with no spending still deserves a line, otherwise it silently
    // vanishes from a range export and the totals look wrong.
    if (rows.length === 0) {
      ctx.sectionRow(formatDate(day.date, locale).toUpperCase());
      dataRow(L.noData, fmt(0), false);
      totalRow(`${L.spent} — ${day.date}`, fmt(0), RED);
    } else {
      section(formatDate(day.date, locale), rows, L.spent);
    }
    dataRow(L.totalRevenue, fmt(dayRevenue(day)), true);
    const balance = dayRevenue(day) - daySpent(day);
    dataRow(L.balance, fmt(balance), false);
  }

  ctx.sectionRow(L.grandTotals.toUpperCase());
  totalRow(L.totalAllocated, fmt(grandRevenue), GREEN);
  totalRow(L.totalExpenses, fmt(grandSpent), RED);
  const grandBalance = grandRevenue - grandSpent;
  totalRow(L.totalBalance, fmt(grandBalance), grandBalance < 0 ? RED : GREEN);
}

// Single combined PDF for the selected main expenses. One page per event
// department per day; when more than one day is exported an overall summary page
// closes the document.
export function generateCombinedPdf(days: PdfDay[], range: { from: string; to: string }, locale: Locale): Promise<Buffer> {
  const ctx = createDoc(locale);
  const { doc, L, R, B, ML, TW, state } = ctx;

  if (days.length === 0) {
    doc.font(B, 14).fillColor('#000').text(L.title, ML, state.y, { width: TW, align: 'center' });
    doc.font(R, 11).fillColor('#666').text(L.noData, ML, state.y + 28, { width: TW, align: 'center' });
    doc.end();
    return ctx.finished;
  }

  // The document opens on a blank first page; reuse it for the first section,
  // then add a fresh page before every subsequent one.
  let started = false;
  const nextPage = () => { if (started) ctx.newPage(); started = true; };

  for (const day of days) {
    for (const ev of sortedEvents(day).filter(eventHasData)) {
      nextPage();
      renderEventDetail(ctx, day, ev, locale);
    }
  }

  if (days.length > 1) {
    nextPage();
    renderSummaryPage(ctx, days, range, locale);
  }

  doc.end();
  return ctx.finished;
}

// Single combined PDF for the day-level additional expenses (kept separate from
// the main expenses). One page per day; a cover summary page for several days.
export function generateExtrasPdf(days: PdfDay[], range: { from: string; to: string }, locale: Locale): Promise<Buffer> {
  const ctx = createDoc(locale);
  const { doc, L, R, ML, TW, state, tableHeader, dataRow, totalRow, heading } = ctx;

  if (days.length === 0) {
    heading(L.extrasTitle, `${L.period}: ${range.from} — ${range.to}`);
    doc.font(R, 11).fillColor('#666').text(L.noData, ML, state.y, { width: TW, align: 'center' });
    doc.end();
    return ctx.finished;
  }

  const multi = days.length > 1;

  if (multi) {
    // Cover summary: per-day totals + grand total.
    heading(L.extrasTitle, `${L.period}: ${range.from} — ${range.to}`);
    tableHeader(L.date, L.amount);
    let shade = false;
    let grand = 0;
    for (const day of days) {
      grand += dayExtrasTotal(day);
      dataRow(formatDate(day.date, locale), fmt(dayExtrasTotal(day)), shade);
      shade = !shade;
    }
    totalRow(L.total, fmt(grand), '#b45309');
  }

  days.forEach((day, di) => {
    if (multi || di > 0) ctx.newPage();
    heading(L.extrasTitle, formatDate(day.date, locale));
    tableHeader(L.name, L.amount);
    if (day.extras.length === 0) {
      dataRow(L.noExtras, fmt(0), false);
      return;
    }
    let shade = false;
    for (const ex of day.extras) {
      dataRow(ex.name, fmt(ex.amountSum), shade);
      shade = !shade;
    }
    totalRow(L.total, fmt(dayExtrasTotal(day)), '#b45309');
  });

  doc.end();
  return ctx.finished;
}
