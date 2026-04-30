/** Format a tiyin value (1/100 of so'm) as a human-readable UZS display string. */
export function formatSum(tiyin: number): string {
  const sums = Math.round(tiyin / 100);
  return sums.toLocaleString('ru-RU') + " so'm";
}

/** Format a tiyin value as a plain number string suitable for <input> fields. */
export function formatSumInput(tiyin: number): string {
  return String(Math.round(tiyin / 100));
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
