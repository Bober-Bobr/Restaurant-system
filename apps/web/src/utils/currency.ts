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
  const normalized = value.replace(/[\s,']/g, '').replace(/so'm?$/i, '').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

/** Parse a user-entered so'm string and return the equivalent tiyin integer, or null if invalid. */
export function parseSumToTiyin(value: string): number | null {
  // Strip thousands separators (space, apostrophe, comma) and the currency label
  const normalized = value.replace(/[\s,']/g, '').replace(/so'm?$/i, '').trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}
