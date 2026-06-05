/** Format a tiyin value (1/100 of so'm) as a human-readable UZS display string. */
export function formatSom(tiyin) {
    const sums = Math.round(tiyin / 100);
    return sums.toLocaleString('ru-RU') + " so'm";
}
/** Convert tiyin to whole so'm (number), for spreadsheet numeric cells. */
export function tiyinToSom(tiyin) {
    return Math.round(tiyin / 100);
}
