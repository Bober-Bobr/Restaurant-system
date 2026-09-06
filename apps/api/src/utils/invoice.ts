/**
 * Invoice arithmetic, server side.
 *
 * This is a second copy — `apps/web/src/utils/invoice.ts` has the same three
 * functions — and the duplication is deliberate: the API cannot import from the
 * web app, and the alternative (trusting the client's figure) is a payment cap
 * that a caller can raise by lying about the total.
 *
 * The two copies MUST agree, or a payment the Invoices page shows as valid gets
 * refused by the server, which is worse than the overpayment the cap prevents.
 * `apps/web/src/utils/invoiceAgreement.test.ts` imports both implementations and
 * runs the same cases through each; that test is the thing keeping them in step,
 * the same way the web suite pins `toSubdomainSlug` against the API's copy.
 *
 * Both read exactly the same inputs — the table package (rate × guests) and the
 * `EventMenuSelection` rows. Neither reads `menuConfig`, so a tablet booking's
 * paid extras are outside the invoice total on both sides. That is a separate
 * question from this cap, and changing it here alone would break the agreement.
 */
export type InvoiceEvent = {
  guestCount: number;
  // `bigint` because these two columns are BIGINT (see the schema): Prisma hands
  // them back as bigints when the row comes straight from the database, and as
  // numbers once `mapEventToExternalId` has been through them. This is called
  // with both, so it takes both.
  depositCents: number | bigint | null;
  tableCategory: { ratePerPerson: number } | null;
  selections: { quantity: number; unitPriceCents: number }[];
  payments: { amountCents: number | bigint }[];
};

/** Total billable price: table package (rate × guests) + selected dishes. */
export function invoiceTotalCents(event: InvoiceEvent): number {
  const tableRate = (event.tableCategory?.ratePerPerson ?? 0) * event.guestCount;
  const dishes = (event.selections ?? []).reduce((sum, s) => sum + s.quantity * s.unitPriceCents, 0);
  return tableRate + dishes;
}

/** Everything already in: the deposit plus every partial payment. */
export function invoicePaidCents(event: InvoiceEvent): number {
  const deposit = Number(event.depositCents ?? 0);
  const payments = (event.payments ?? []).reduce((sum, p) => sum + Number(p.amountCents), 0);
  return deposit + payments;
}

/** Remaining balance, never negative. */
export function invoiceOutstandingCents(event: InvoiceEvent): number {
  return Math.max(0, invoiceTotalCents(event) - invoicePaidCents(event));
}
