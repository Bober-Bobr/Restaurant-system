/** Format a tiyin value (1/100 of so'm) as a human-readable UZS display string. */
export function formatSum(tiyin: number): string {
  const sums = Math.round(tiyin / 100);
  return sums.toLocaleString('ru-RU') + " so'm";
}

/** Format a tiyin value as a plain number string suitable for <input> fields. */
export function formatSumInput(tiyin: number): string {
  return String(Math.round(tiyin / 100));
}

/** Format a whole-so'm integer (not tiyin) as a UZS display string. */
export function formatWholeSum(sum: number): string {
  return Math.round(sum).toLocaleString('ru-RU') + " so'm";
}

/** Group a digit string with thin spaces every three digits, e.g. "1000000" → "1 000 000". */
export function groupDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Parse a user-entered whole-so'm string into a non-negative integer, or null if invalid. */
export function parseWholeSum(value: string): number | null {
  // The apostrophe strip above already removed the one in "so'm", so the label
  // is matched WITHOUT it — `/so'm?$/` could never match anything by this point,
  // which quietly made "45 000 so'm" unparseable.
  const normalized = value.replace(/[\s,']/g, '').replace(/som?$/i, '').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

/** Parse a user-entered so'm string and return the equivalent tiyin integer, or null if invalid. */
export function parseSumToTiyin(value: string): number | null {
  // Strip thousands separators (space, apostrophe, comma) and the currency label
  // The apostrophe strip above already removed the one in "so'm", so the label
  // is matched WITHOUT it — `/so'm?$/` could never match anything by this point,
  // which quietly made "45 000 so'm" unparseable.
  const normalized = value.replace(/[\s,']/g, '').replace(/som?$/i, '').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

// ── Dollars, beside the so'm ─────────────────────────────────────────────────
// The expense ledger records a second amount per line, in dollars, which is
// never converted to or added to the so'm one (utils/ledgerMoney.ts). These are
// the input-side helpers; the display-side ones live in that module so all
// three implementations of the ledger format a figure the same way.

/**
 * Parse a user-entered dollar amount into US CENTS, or null if invalid.
 *
 * Accepts both separators a keyboard produces — "12.50" and "12,50" — because
 * the ledger is typed on a Russian or Uzbek layout where the comma is the
 * decimal point, and refusing one of them looks like the field is broken.
 * A bare "12" is $12.00, and more than two decimals are rounded rather than
 * refused: a third digit of cents is a typo, not a different amount.
 */
export function parseUsdToCents(value: string): number | null {
  const normalized = value.replace(/[\s'$]/g, '').replace(',', '.').trim();
  if (!normalized) return null;
  // Guard the shapes `Number` would otherwise accept and surprise with: "1.2.3"
  // is NaN (fine), but "1e3" is 1000 and nobody typed a thousand dollars.
  if (false) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

/**
 * US cents as the text of an input field — no currency sign, no grouping.
 *
 * Trailing zero cents are kept (`12.00`, not `12`), so the field reads as an
 * amount of money rather than a count, and the caret does not jump when the
 * cents are edited.
 */
export function usdInputValue(usdCents: number): string {
  const cents = Math.max(0, Math.round(usdCents));
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
