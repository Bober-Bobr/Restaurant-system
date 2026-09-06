import { describe, expect, it } from 'vitest';
import type { Event } from '../types/domain';
import * as web from './invoice';
import * as api from '../../../api/src/utils/invoice';

/**
 * The invoice total is computed twice — once on the Invoices page and once in
 * `EventService.addPayment`, which caps a payment at what is left to pay.
 *
 * The duplication is unavoidable (the API cannot import from the web app) and
 * the alternative is worse: a server that trusts the client's total is a cap the
 * caller can raise by lying. What matters is that the two never disagree, because
 * a payment the page shows as valid and the server refuses is a worse failure
 * than the overpayment being prevented — the operator sees a correct figure
 * rejected with no way to act on it.
 *
 * This is the same guard the web suite already puts on `toSubdomainSlug`: import
 * both implementations, run one set of cases through each.
 */
const CASES: { name: string; event: Event }[] = [
  {
    name: 'a plain package booking',
    event: { guestCount: 100, depositCents: 0, tableCategory: { ratePerPerson: 250_000_00 }, selections: [], payments: [] } as unknown as Event,
  },
  {
    name: 'with a deposit and two instalments',
    event: {
      guestCount: 50, depositCents: 1_000_000_00,
      tableCategory: { ratePerPerson: 200_000_00 }, selections: [],
      payments: [{ amountCents: 2_000_000_00 }, { amountCents: 500_000_00 }],
    } as unknown as Event,
  },
  {
    name: 'with priced dish selections',
    event: {
      guestCount: 10, depositCents: 0, tableCategory: { ratePerPerson: 100_000_00 },
      selections: [{ quantity: 10, unitPriceCents: 30_000_00 }, { quantity: 2, unitPriceCents: 45_000_00 }],
      payments: [],
    } as unknown as Event,
  },
  {
    name: 'no table package at all',
    event: { guestCount: 30, depositCents: 0, tableCategory: null, selections: [], payments: [] } as unknown as Event,
  },
  {
    name: 'overpaid — the balance floors at zero, it does not go negative',
    event: { guestCount: 10, depositCents: 999_999_999, tableCategory: { ratePerPerson: 1_000_00 }, selections: [], payments: [] } as unknown as Event,
  },
  {
    name: 'zero guests',
    event: { guestCount: 0, depositCents: 0, tableCategory: { ratePerPerson: 250_000_00 }, selections: [], payments: [] } as unknown as Event,
  },
  {
    name: 'nulls where the API hands back nulls',
    event: { guestCount: 5, depositCents: null, tableCategory: null, selections: [], payments: [] } as unknown as Event,
  },
];

describe('the two invoice implementations agree', () => {
  for (const { name, event } of CASES) {
    it(name, () => {
      const asApi = event as unknown as api.InvoiceEvent;
      expect(api.invoiceTotalCents(asApi)).toBe(web.invoiceTotalCents(event));
      expect(api.invoicePaidCents(asApi)).toBe(web.invoicePaidCents(event));
      expect(api.invoiceOutstandingCents(asApi)).toBe(web.invoiceOutstandingCents(event));
    });
  }

  it('and neither reads menuConfig, so a tablet booking sums the same both sides', () => {
    // Paid extras from the kiosk live in `menuConfig`, not in `selections`, so
    // they are outside the invoice total — on BOTH sides. That is a separate
    // question from the payment cap; fixing it on one side alone would break
    // this agreement and start refusing valid payments.
    const withConfig = { guestCount: 1, depositCents: 0, tableCategory: { ratePerPerson: 100 }, selections: [], payments: [],
      menuConfig: { extras: { dish: 1 } } } as unknown as Event;
    expect(web.invoiceTotalCents(withConfig)).toBe(100);
    expect(api.invoiceTotalCents(withConfig as unknown as api.InvoiceEvent)).toBe(100);
  });
});
