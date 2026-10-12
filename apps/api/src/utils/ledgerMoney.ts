/**
 * Two currencies on one ledger line — so'm and dollars, kept apart.
 *
 * ── WHY A PAIR AND NOT A SECOND NUMBER ─────────────────────────────────────
 * Every price in the expense ledger can now carry a dollar amount **as well
 * as** a so'm amount: some of what a restaurant buys and pays out is settled
 * in cash dollars, and recording it as so'm would be a figure nobody can
 * reconcile against the money that actually moved.
 *
 * The one rule everything here exists to enforce: **the two are never added
 * together.** There is no exchange rate in this product, and there must not be
 * one — a rate typed today would silently restate every day already recorded,
 * and a single "total" built from two currencies is a number that looks like
 * money and is not. So a total is a PAIR, a balance is a PAIR, and the type
 * makes the mistake impossible to write: `Money` is not a number, so it cannot
 * be summed into a so'm figure by accident.
 *
 * ── UNITS, WHICH ARE NOT THE SAME ON BOTH SIDES ────────────────────────────
 * `sum` is **whole so'm**, because that is what every ledger column already
 * holds (`amountSum`, `pricePerGuestSum`) — the smallest coin in circulation
 * is worth less than a rounding error on a banquet.
 * `usdCents` is **cents**, because $12.50 is an ordinary amount and a ledger
 * that could not record the 50 would be wrong about the money.
 * The field names carry the unit for exactly this reason.
 *
 * Mirrored in `apps/web/src/utils/ledgerMoney.ts` — the API cannot import from
 * the web app — and `ledgerMoneyAgreement.test.ts` imports **both** and runs
 * one set of cases through each, the guard already standing over
 * `toSubdomainSlug`, the invoice arithmetic and the section rule.
 */

export type Money = {
  /** Whole so'm (not tiyin) — the unit every ledger column already uses. */
  sum: number;
  /** US cents. $12.50 is 1250. */
  usdCents: number;
};

/** A ledger line as this module needs it: one amount per currency. */
export type MoneyLine = {
  amountSum?: number | null;
  amountUsdCents?: number | null;
};

export const ZERO_MONEY: Money = { sum: 0, usdCents: 0 };

/**
 * The caps, which exist because both columns are a 32-bit `Int`.
 *
 * So'm stops at a billion, as it already did. Dollars stop at a million,
 * which in cents is 100 000 000 — comfortably inside the column and far above
 * anything one line of a day's ledger will hold.
 */
export const MAX_SUM = 1_000_000_000;
export const MAX_USD_CENTS = 100_000_000;

const whole = (value: number | null | undefined, max: number): number => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(0, Math.round(n)));
};

/** A stored line read as a pair, with anything missing or malformed read as nothing. */
export function moneyOf(line: MoneyLine | null | undefined): Money {
  return {
    sum: whole(line?.amountSum, MAX_SUM),
    usdCents: whole(line?.amountUsdCents, MAX_USD_CENTS),
  };
}

/** A pair built from two raw figures, clamped to what the columns can hold. */
export function money(sum: number | null | undefined, usdCents: number | null | undefined): Money {
  return { sum: whole(sum, MAX_SUM), usdCents: whole(usdCents, MAX_USD_CENTS) };
}

/** Componentwise. Deliberately the only way to combine two amounts. */
export function addMoney(a: Money, b: Money): Money {
  return { sum: a.sum + b.sum, usdCents: a.usdCents + b.usdCents };
}

/**
 * Componentwise, and **allowed to go negative** — a balance is a subtraction
 * and a department can run at a loss in either currency independently. This is
 * the one function here that does not clamp at zero.
 */
export function subtractMoney(a: Money, b: Money): Money {
  return { sum: a.sum - b.sum, usdCents: a.usdCents - b.usdCents };
}

/** A per-unit price times a count — guests × price per guest, in both currencies. */
export function scaleMoney(unit: Money, count: number): Money {
  const n = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  return { sum: unit.sum * n, usdCents: unit.usdCents * n };
}

/** Every line of a section, added up. */
export function sumMoney(lines: readonly MoneyLine[] | null | undefined): Money {
  return (lines ?? []).reduce<Money>((acc, line) => addMoney(acc, moneyOf(line)), ZERO_MONEY);
}

/**
 * Whether a dollar figure was recorded at all.
 *
 * This is what every surface asks before it shows a dollar column: a ledger
 * kept entirely in so'm — which is most of them — must look exactly as it did
 * before this existed, rather than gaining a column of dashes and a second
 * figure of zero beside every total.
 */
export function hasUsd(m: Money): boolean {
  return m.usdCents !== 0;
}

/** Whether anything in this set of amounts is in dollars. */
export function anyUsd(amounts: readonly Money[]): boolean {
  return amounts.some(hasUsd);
}

/**
 * Both currencies as one display string, or just the so'm when there are no
 * dollars. The separator is a middot rather than a plus: they are two amounts
 * standing side by side, and `+` invites the reader to do the one piece of
 * arithmetic this whole module refuses to do.
 */
export function formatMoney(m: Money): string {
  return hasUsd(m) ? `${formatSom(m.sum)} · ${formatUsd(m.usdCents)}` : formatSom(m.sum);
}

/** Whole so'm as a display string. */
export function formatSom(sum: number): string {
  return `${Math.round(sum).toLocaleString('ru-RU')} so'm`;
}

/**
 * US cents as a display string.
 *
 * Always two decimal places, and the minus sign placed before the `$` rather
 * than after it, because `$-40.00` reads as a price and `-$40.00` reads as a
 * loss — and on this page a negative figure is always a loss.
 */
export function formatUsd(usdCents: number): string {
  const cents = Math.round(usdCents);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('ru-RU');
  return `${sign}$${whole}.${String(abs % 100).padStart(2, '0')}`;
}
