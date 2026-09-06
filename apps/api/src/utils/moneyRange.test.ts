import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { invoiceOutstandingCents, invoicePaidCents, invoiceTotalCents } from './invoice.js';

/**
 * The reported bug: "Add payment" did nothing, above roughly 20–30 million.
 *
 * `EventPayment.amountCents` and `Event.depositCents` stored **tiyin** in a
 * 32-bit integer, and 2 147 483 647 tiyin is 21 474 836 so'm. A 200-guest
 * banquet at 250 000 a head is 50 000 000, so every payment big enough to
 * matter was refused by Postgres outright — and the Invoices page had no error
 * handler, so the button simply did nothing.
 *
 * They are BIGINT now, and Prisma hands a BIGINT column back as a JavaScript
 * `bigint`. That is the second half of the fix: `JSON.stringify` throws on a
 * bigint, so anything that reaches a response has to be converted first.
 */
const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(API_ROOT, rel), 'utf8');

const INT4_MAX = 2_147_483_647;
const SOM = 100;   // tiyin per so'm

describe('the ceiling that caused this', () => {
  it('is 21 474 836 so\'m, which is the figure that was reported', () => {
    expect(Math.floor(INT4_MAX / SOM)).toBe(21_474_836);
  });

  it('a real banquet passes it comfortably', () => {
    // 200 guests × 250 000 so'm — an ordinary wedding, not an outlier.
    const total = invoiceTotalCents({
      guestCount: 200, depositCents: 0,
      tableCategory: { ratePerPerson: 250_000 * SOM },
      selections: [], payments: [],
    });
    expect(total).toBe(50_000_000 * SOM);
    expect(total, 'this is what Postgres was refusing').toBeGreaterThan(INT4_MAX);
  });

  it('and the arithmetic is exact well past it', () => {
    // A JS number is exact to 2^53 tiyin — ninety trillion so'm — so converting
    // the bigint at the boundary loses nothing a restaurant could ever bill.
    expect(Number.isSafeInteger(90_000_000_000_000 * SOM)).toBe(true);
    const outstanding = invoiceOutstandingCents({
      guestCount: 200, depositCents: 20_000_000 * SOM,
      tableCategory: { ratePerPerson: 250_000 * SOM },
      selections: [], payments: [{ amountCents: 10_000_000 * SOM }],
    });
    expect(outstanding).toBe(20_000_000 * SOM);
  });
});

describe('the invoice math takes bigints as well as numbers', () => {
  // A row straight from Prisma carries bigints; one that has been through
  // `mapEventToExternalId` carries numbers. Both reach these functions.
  const asBigint = {
    guestCount: 100, depositCents: BigInt(5_000_000 * SOM),
    tableCategory: { ratePerPerson: 250_000 * SOM },
    selections: [], payments: [{ amountCents: BigInt(1_000_000 * SOM) }],
  };
  const asNumber = { ...asBigint, depositCents: 5_000_000 * SOM, payments: [{ amountCents: 1_000_000 * SOM }] };

  it('and gets the same answer either way', () => {
    expect(invoicePaidCents(asBigint)).toBe(invoicePaidCents(asNumber));
    expect(invoiceOutstandingCents(asBigint)).toBe(invoiceOutstandingCents(asNumber));
  });

  it('returning a number, never a bigint', () => {
    // `bigint + number` throws, so a leaked bigint would take the whole request
    // down rather than merely being wrong.
    expect(typeof invoicePaidCents(asBigint)).toBe('number');
    expect(typeof invoiceOutstandingCents(asBigint)).toBe('number');
  });
});

describe('nothing hands a bigint to JSON', () => {
  it('the two columns are BigInt in the schema', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toMatch(/depositCents\s+BigInt/);
    expect(schema).toMatch(/amountCents BigInt/);
  });

  it('and a migration widens them in place', () => {
    const dir = path.join(API_ROOT, 'prisma', 'migrations', '20260906120000_money_bigint');
    const sql = fs.readFileSync(path.join(dir, 'migration.sql'), 'utf8');
    expect(sql).toContain('ALTER TABLE "Event" ALTER COLUMN "depositCents" TYPE BIGINT');
    expect(sql).toContain('ALTER TABLE "EventPayment" ALTER COLUMN "amountCents" TYPE BIGINT');
  });

  it('the service converts both on the way out', () => {
    // Prisma returns a bigint; `JSON.stringify` throws on one, so leaving it
    // would turn every event response into a 500 — a worse bug than the one
    // being fixed.
    const service = read('src/modules/events/event.service.ts');
    expect(service).toContain('depositCents: Number(rest.depositCents ?? 0)');
    expect(service).toContain('amountCents: Number(p.amountCents)');
  });

  it('a real response survives JSON.stringify', () => {
    // The regression this guards is not subtle, but it is silent until a request
    // is actually made.
    const row = { eventNumber: 42, depositCents: BigInt(5_000_000 * SOM), payments: [{ amountCents: BigInt(1) }] };
    expect(() => JSON.stringify(row), 'the raw row is what throws').toThrow();
    const mapped = {
      ...row, id: row.eventNumber,
      depositCents: Number(row.depositCents),
      payments: row.payments.map((p) => ({ ...p, amountCents: Number(p.amountCents) })),
    };
    expect(() => JSON.stringify(mapped)).not.toThrow();
  });
});

describe('and the page says so when a payment is refused', () => {
  it('the mutation has an error handler at all', () => {
    // It had none, which is the whole of "clicking the button simply doesn't
    // work": the request failed and the page said nothing.
    const page = fs.readFileSync(
      path.join(API_ROOT, '..', 'web', 'src', 'pages', 'AdminInvoicesPage.tsx'), 'utf8',
    );
    // Bounded by the NEXT declaration, not by the first `});` — the mutation
    // body contains several of those, and slicing at one cuts the handler off.
    const from = page.indexOf('const addPaymentMutation');
    const to = page.indexOf('const removePaymentMutation');
    expect(from, 'the mutation is gone').toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(page.slice(from, to)).toContain('onError:');
    expect(page).toContain("t('payment_failed')");
    // The server's own message is preferred when it sent one — it names the
    // maximum, which a generic string cannot.
    expect(page).toContain("response?.data?.message || t('payment_failed')");
  });
});
