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
 * Both read exactly the same inputs, in the same three parts:
 *
 *   1. the AGREED total the kiosk confirmed (`menuConfig.invoiceTotalCents` —
 *      package, extras, children's table, services, discount or a manual
 *      figure, all already applied), or, for a booking that has none, the table
 *      package (rate × guests);
 *   2. the `EventMenuSelection` rows typed on the Events page;
 *   3. a service order's own total (`menuConfig.diningOrder.totalCents`).
 *
 * The package rate alone used to be the whole of part 1, so every booking whose
 * money was decided in the kiosk or in a service order came out at ZERO — and
 * with nothing owed, every payment was refused as "more than the balance".
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
  /** Free-form JSON; only the two figures below are read, and both defensively. */
  menuConfig?: unknown;
};

/** A stored money figure, or null — a hand-edited JSON row must not be able to invent one. */
const centsIn = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

/** Total billable price — see the three parts at the top of this file. */
export function invoiceTotalCents(event: InvoiceEvent): number {
  const config = (event.menuConfig ?? null) as
    { invoiceTotalCents?: unknown; diningOrder?: { totalCents?: unknown } | null } | null;
  const agreed = centsIn(config?.invoiceTotalCents);
  const tableRate = agreed ?? (event.tableCategory?.ratePerPerson ?? 0) * event.guestCount;
  const dishes = (event.selections ?? []).reduce((sum, s) => sum + s.quantity * s.unitPriceCents, 0);
  const served = centsIn(config?.diningOrder?.totalCents) ?? 0;
  return tableRate + dishes + served;
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
