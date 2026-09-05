import { formatSum } from './currency';

/**
 * A table category's price, and its name written with the price beside it.
 *
 * A table category IS a price package — it is the one thing a guest is choosing
 * between, and the whole event total is `ratePerPerson × guests`. The kiosk
 * showed the price on the big chooser slide and then dropped it everywhere
 * afterwards: the dropdown, the confirmation chip, the section headings and the
 * summary all named the package and nothing else, so from the moment a guest
 * picked one the figure they picked it for was off the screen.
 *
 * Both halves live here rather than being formatted at each call site, so the
 * separator, the order and the "per person" suffix cannot drift between the
 * eight places that show it.
 *
 * `perPerson` is passed in rather than translated here: this file has no locale,
 * and the caller already holds a bound `t`.
 */
export type PricedTableCategory = { name: string; ratePerPerson: number };

export function tableCategoryPrice(category: PricedTableCategory, perPerson: string): string {
  return `${formatSum(category.ratePerPerson)} / ${perPerson}`;
}

export function tableCategoryLabel(category: PricedTableCategory, perPerson: string): string {
  return `${category.name} · ${tableCategoryPrice(category, perPerson)}`;
}
