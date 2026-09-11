import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_TEMPLATES } from './templates';

/**
 * The groom's name comes first.
 *
 * Eight of the nine wedding designs were authored bride-first, which is the
 * convention this product's market does not use. The order is not stored
 * anywhere — it IS the markup — so it lives in three separate places per
 * template and every one of them has to agree:
 *
 *   · the order of the two elements wherever both names are shown;
 *   · the `couple` / `coupleFull` string the script joins for the single-line
 *     places (the card, the footer, the calendar note);
 *   · `document.title`, which is what a guest sees in a shared link preview.
 *
 * Miss one and the invitation contradicts itself between the hero and the tab
 * title, which is worse than being consistently wrong. Hence a check on all
 * three rather than on the hero alone.
 */
const DIR = join(__dirname, 'templates');
const read = (id: string) => readFileSync(join(DIR, id, 'template.html'), 'utf8');

const WEDDINGS = RICH_TEMPLATES.filter((t) => t.category === 'wedding');

/** Markup only — the script mentions both names constantly and in no order. */
function markup(src: string): string {
  return src
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
}

/**
 * The two names as they appear down the page, normalised.
 *
 * Templates name them in two ways — `data-bind="groomName"` on a plain span,
 * and `data-name="groom"` on the four newest, whose hero rebuilds each name as
 * individual letter spans. Both are the same decision.
 */
function nameRun(src: string): ('groom' | 'bride')[] {
  return [...markup(src).matchAll(/data-(?:bind|name)="(groom|bride)(?:Name|Full)?"/g)]
    .map((m) => m[1] as 'groom' | 'bride');
}

it('covers every wedding design', () => {
  // Not a tautology over an empty set, and it fails if a wedding template is
  // added without being considered here.
  expect(WEDDINGS.length).toBe(9);
});

describe.each(WEDDINGS.map((t) => [t.id] as const))('%s', (id) => {
  const src = read(id);

  it('shows the groom first everywhere both names appear', () => {
    const run = nameRun(src);
    expect(run.length, 'neither name is bound in the markup at all').toBeGreaterThan(0);
    // Both names always appear as a pair, so the run alternates. An entry at an
    // even index that is not the groom is a pair the swap missed.
    const wrong = run
      .map((who, i) => ({ who, i }))
      .filter(({ who, i }) => (i % 2 === 0 ? who !== 'groom' : who !== 'bride'))
      .map(({ i }) => i);
    expect(wrong, `name №${wrong.join(', ')} is out of order — a pair still reads bride-first`)
      .toEqual([]);
  });

  /**
   * Every expression that joins the two names into one string.
   *
   * `<span>a</span> & <span>b</span>` is covered above; this is the other half,
   * the places that take one already-joined string — the card line, the footer,
   * the calendar note and the tab title.
   *
   * Filtered on mentioning BOTH names, because several templates reuse `couple`
   * further down as the section element (`var couple = $('#couple')`), which is
   * a different thing wearing the same name.
   */
  const joins = [
    ...[...src.matchAll(/var\s+couple(?:Full)?\s*=\s*([^;]+);/g)].map((m) => m[1]),
    ...[...src.matchAll(/document\.title\s*=\s*([^;]+);/g)].map((m) => m[1]),
    ...[...src.matchAll(/var\s+title\s*=\s*([^;]+);/g)].map((m) => m[1]),
  ].filter((j) => /\bbride/.test(j) && /\bgroom/.test(j));

  it('builds the one-line couple string groom first', () => {
    // Read the CONCATENATION, not the whole expression.
    //
    // Every one of these is a ternary whose guard mentions both names before
    // the join does — `(groom && bride) ? (groom + ' & ' + bride) : …`. Asking
    // which name appears first in the expression therefore answers a question
    // about the GUARD, and passes happily against a join that was put back the
    // old way round underneath it. That is not hypothetical: it is exactly what
    // the first version of this check did.
    const wrong = joins.filter((expr) => {
      const cat = /\b(groom|bride)(?:Full)?\s*\+[^+]*\+\s*(groom|bride)(?:Full)?\b/.exec(expr);
      return cat ? cat[1] !== 'groom' : false;
    });
    expect(wrong, 'these join the two names bride-first').toEqual([]);

    // And the join has to be found at all, or the check above is vacuous.
    const joined = joins.filter((expr) => /\b(?:groom|bride)(?:Full)?\s*\+[^+]*\+\s*(?:groom|bride)(?:Full)?\b/.test(expr));
    expect(joined.length, 'no expression joins the two names — has the shape changed?')
      .toBe(joins.length);
  });

  it('joins them somewhere — as a string or as two elements', () => {
    // Guards the check above from passing vacuously if the joins are ever
    // renamed out from under its regexes.
    expect(joins.length + nameRun(src).length).toBeGreaterThan(0);
  });
});

describe('the builder asks in the same order it prints', () => {
  // A form that asks for the bride first and a design that prints the groom
  // first is how the two get typed into the wrong boxes.
  for (const tpl of WEDDINGS) {
    it(tpl.id, () => {
      const paths = tpl.fields.map((f) => f.path);
      for (const pair of [['couple.groom', 'couple.bride'], ['couple.groomFull', 'couple.brideFull']]) {
        const [g, b] = pair.map((p) => paths.indexOf(p));
        if (g === -1 || b === -1) continue;
        expect(g, `${pair[1]} is asked for before ${pair[0]}`).toBeLessThan(b);
      }
    });
  }
});
