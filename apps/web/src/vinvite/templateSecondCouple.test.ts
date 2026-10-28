import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_TEMPLATES } from './templates';
import { pickLocale, type LocalizedText } from './templates/types';

/**
 * A DOUBLE WEDDING — a second bride and groom, in every wedding design.
 *
 * Two couples married in one evening is a real booking in this market, and the
 * designs could express it in exactly one way before this: by typing four names
 * into two boxes. So each of them now takes an optional second pair, and the
 * whole feature rests on one convention that is the same in all ten:
 *
 *   · `couple.groom2` / `couple.bride2` in the config (plus `*Full2` where the
 *     design already asks for formal names), asked for in a group of their own;
 *   · `groomName2` / `brideName2` bound in the markup, or `data-name="groom2"`
 *     where the hero rebuilds a name letter by letter;
 *   · every element belonging to the second couple carrying `.duo`, HIDDEN by
 *     default, and revealed by `has-duo` on <html> — which the boot sets only
 *     when a second name has actually been typed;
 *   · the one-line places (the tab title, the envelope card, the footer) taking
 *     both pairs as one string.
 *
 * The last two are what make this safe to ship against invitations already
 * published: with the fields empty nothing is revealed, no separator is added,
 * and the page is byte-identical to what it was. That is the property worth a
 * test — it cannot be seen by reading any one template, and it is ten chances
 * to get it wrong.
 */
const DIR = join(__dirname, 'templates');
const read = (id: string) => readFileSync(join(DIR, id, 'template.html'), 'utf8');

const WEDDINGS = RICH_TEMPLATES.filter((t) => t.category === 'wedding');

/** The stylesheet and the boot script, which is where the rules below live. */
const styles = (src: string) => [...src.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const scripts = (src: string) => [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
const markup = (src: string) => src.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');

function at(config: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node == null ? node : (node as Record<string, unknown>)[key]), config);
}

it('covers every wedding design', () => {
  // Not a tautology over an empty set, and it fails if a wedding design is
  // added without being given a second couple.
  expect(WEDDINGS.length).toBe(12);
});

describe.each(WEDDINGS.map((t) => [t.id] as const))('%s', (id) => {
  const tpl = WEDDINGS.find((t) => t.id === id)!;
  const src = read(id);

  it('asks for the second pair, in a group of its own', () => {
    const paths = tpl.fields.map((f) => f.path);
    expect(paths, 'the second groom is not in the builder at all').toContain('couple.groom2');
    expect(paths).toContain('couple.bride2');

    // Its own group, so the form says what these two boxes are for. Dropped in
    // among the first couple's fields, four name boxes in a row is how two
    // couples get typed into the wrong ones.
    for (const key of ['couple.groom2', 'couple.bride2']) {
      const field = tpl.fields.find((f) => f.path === key)!;
      const group = tpl.groups.find((g) => g.key === field.group);
      expect(group, `${key} is in a group this template does not declare`).toBeTruthy();
      expect(group!.labelKey, `${key} is not in the second-couple group`).toBe('tg_couple2');
    }
  });

  it('a design where the first pair has formal names asks for the second pair`s too', () => {
    // Otherwise the invitation card prints one couple in full and the other by
    // their first names, on the same line.
    const paths = tpl.fields.map((f) => f.path);
    if (!paths.includes('couple.groomFull')) return;
    expect(paths).toContain('couple.groomFull2');
    expect(paths).toContain('couple.brideFull2');
  });

  it('ships EMPTY, so nothing already published changes', () => {
    // The catalog and the pricing preview both render `defaultConfig`, so a
    // sample second pair would advertise every design as a double wedding —
    // and every honoree who is not having one would have to delete it.
    for (const key of ['couple.groom2', 'couple.bride2', 'couple.groomFull2', 'couple.brideFull2']) {
      const value = at(tpl.defaultConfig, key);
      if (value === undefined) continue;
      for (const lang of ['ru', 'uz', 'en'] as const) {
        expect(pickLocale(value as LocalizedText, lang), `${key} ships with a name in it`).toBe('');
      }
    }
  });

  it('binds both of the second pair`s names in the markup', () => {
    const body = markup(src);
    const bound = (name: string) => body.includes(`data-bind="${name}"`) || body.includes(`data-name="${name}"`);
    expect(bound('groomName2') || bound('groom2'), 'the second groom is never printed').toBe(true);
    expect(bound('brideName2') || bound('bride2'), 'the second bride is never printed').toBe(true);
  });

  it('hides the second couple until there is one', () => {
    const css = styles(src);
    // The two halves of the mechanism. Without the first, a design with no
    // second couple shows an empty cluster and a dangling separator; without
    // the second, a double wedding is typed in and nothing appears.
    //
    // Matched as patterns rather than as fixed text because these ten
    // stylesheets are not written in one format — some end a declaration with
    // a semicolon and some do not, and a check on the exact bytes would be
    // asserting the house style rather than the rule.
    expect(css, '.duo is not hidden by default').toMatch(/\.duo\s*\{\s*display:\s*none;?\s*\}/);
    expect(css, 'has-duo does not reveal .duo').toMatch(/html\.has-duo\s+\.duo\s*\{\s*display:\s*revert;?\s*\}/);
    expect(markup(src), 'nothing on the page is marked as the second couple`s').toMatch(/class="[^"]*\bduo\b/);
  });

  it('sets has-duo from the second pair, and only from it', () => {
    const js = scripts(src);
    // Read as a pair of statements rather than as "mentions has-duo": the class
    // has to come OFF again when the names are cleared in the builder, where
    // every keystroke re-runs this and nothing reloads the page.
    expect(js, 'has-duo is never added').toMatch(/if\s*\(pair2\)\s*document\.documentElement\.classList\.add\('has-duo'\)/);
    expect(js, 'has-duo is never removed, so clearing the names leaves it on')
      .toMatch(/else\s*document\.documentElement\.classList\.remove\('has-duo'\)/);
  });

  it('carries both pairs in the one-line places', () => {
    const js = scripts(src);
    // `bothPairs` is the first couple plus the second, and the tab title is the
    // place that proves it is used: a shared link preview naming one of two
    // couples is the most visible way to get this wrong.
    expect(js, 'no second pair is joined').toMatch(/var\s+pair2\s*=/);
    expect(js, 'the two pairs are never combined').toMatch(/var\s+bothPairs\s*=\s*couple\s*\+/);
    expect(js, 'the tab title still names one couple').toMatch(/document\.title\s*=\s*bothPairs\b/);
  });

  it('separates the pairs with a middot, never a second ampersand', () => {
    // An ampersand already says "these two are marrying each other". Used
    // again between the pairs it reads as one list of four people, which is
    // the opposite of what a double wedding is.
    const js = scripts(src);
    const combine = /var\s+bothPairs\s*=\s*([^;]+);/.exec(js);
    expect(combine, 'bothPairs is not built where this can be checked').toBeTruthy();
    expect(combine![1]).toContain('·');
    expect(combine![1], 'the pairs are joined with an ampersand').not.toContain('&');
  });
});
