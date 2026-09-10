import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_TEMPLATES } from './templates';

/**
 * The "Where" block: a photograph of the venue, its address, and one link into
 * the guest's map app.
 *
 * The artwork in these designs is part of the design and ships bundled; the
 * venue photograph is the exception, marked in the markup with
 * `data-photo="<config path>"`. `bindArtwork` prefers whatever that path holds
 * and falls back to `data-asset` when it is empty, so an invitation nobody has
 * touched looks exactly as it did before.
 *
 * The failure this file exists for is quiet and specific. An uploaded image is
 * stored as a RELATIVE `/uploads/...` path, and `resolveAssetUrls` absolutizes
 * it against the API origin — but only for paths it finds declared as a
 * `type: 'image'` FIELD. The template runs in a sandboxed `srcdoc` iframe on an
 * opaque origin, where a relative URL resolves to nothing. So a `data-photo`
 * path with no matching field gives an editor that appears to accept the upload
 * and a published invitation with a broken image, and nothing in between says
 * so.
 */
const DIR = join(__dirname, 'templates');
const read = (id: string) => readFileSync(join(DIR, id, 'template.html'), 'utf8');

/** `data-photo` paths declared in the markup, per template. */
function photoSlots(src: string): string[] {
  return [...src.matchAll(/<img[^>]*\sdata-photo="([^"]+)"/g)].map((m) => m[1]);
}

const WITH_SLOTS = RICH_TEMPLATES.filter((t) => photoSlots(read(t.id)).length > 0);

it('the templates that were given a replaceable plate still have one', () => {
  // Not a tautology over an empty set: name them, so removing the attribute from
  // all four turns every check below into a vacuous pass and this one fails.
  expect(WITH_SLOTS.map((t) => t.id).sort()).toEqual([
    'wedding-chateau', 'wedding-paris', 'wedding-samarkand', 'wedding-stillvatn',
  ]);
});

describe.each(WITH_SLOTS.map((t) => [t.id, t] as const))('%s', (id, tpl) => {
  const src = read(id);
  const slots = photoSlots(src);

  it('declares each slot as an image field, so an upload gets an absolute URL', () => {
    const imageFields = new Set(tpl.fields.filter((f) => f.type === 'image').map((f) => f.path));
    const undeclared = slots.filter((p) => !imageFields.has(p));
    expect(
      undeclared,
      `data-photo path with no matching type:'image' field — the editor will accept `
      + `an upload and the published invitation will show a broken image: ${undeclared.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps a bundled fallback on the same element', () => {
    // The whole point is that an untouched invitation is unchanged. An element
    // carrying data-photo but no data-asset renders empty until someone uploads.
    for (const tag of src.match(/<img[^>]*\sdata-photo="[^"]+"[^>]*>/g) ?? []) {
      expect(tag, 'a replaceable plate with no bundled default').toContain('data-asset=');
    }
  });

  it('defaults the slot to empty, so nothing already published changes', () => {
    for (const path of slots) {
      const value = path.split('.').reduce<unknown>(
        (acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined),
        tpl.defaultConfig as unknown,
      );
      expect(value, `${path} ships with a value, which would replace the bundled art`).toBe('');
    }
  });

  it('prefers the uploaded photo over the bundled asset, in the one binding pass', () => {
    // Both must be read in `bindArtwork`. A second place that also sets `src`
    // would race this one on every config push in the editor.
    const at = src.indexOf('function bindArtwork');
    expect(at, 'bindArtwork is gone').toBeGreaterThan(-1);
    const body = src.slice(at, at + 1600).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(body, 'the custom photo is never read').toContain("getAttribute('data-photo')");
    expect(body, 'the bundled asset no longer acts as the fallback')
      .toMatch(/custom\s*\|\|\s*asset\(/);
  });
});

describe('the Where block is wired end to end', () => {
  for (const [id, tpl] of WITH_SLOTS.map((t) => [t.id, t] as const)) {
    const src = read(id);

    it(`${id}: has a map link the renderer fills`, () => {
      expect(src, 'no map button').toContain('id="mapBtn"');
      // An <a> with no href is not a link and is not focusable, so the button
      // is only useful once renderPlace() has put one on it.
      expect(src).toContain('function renderPlace');
      const call = src.slice(src.indexOf('function renderAll'));
      expect(call.slice(0, 600), 'renderPlace is defined but never called').toContain('renderPlace();');
    });

    it(`${id}: falls back to a map search when no URL was entered`, () => {
      // Most couples will not paste a Yandex link. Building a search from the
      // address is what makes the button work anyway — and the button existing
      // but doing nothing is worse than no button.
      const fn = src.slice(src.indexOf('function renderPlace'));
      expect(fn.slice(0, 900)).toContain("cfg('venue.mapUrl'");
      expect(fn.slice(0, 900)).toMatch(/yandex\.com\/maps\/\?text=/);
    });

    it(`${id}: declares the address and the map URL as fields`, () => {
      const paths = new Set(tpl.fields.map((f) => f.path));
      for (const p of ['venue.address', 'venue.mapUrl', 'venue.image']) {
        expect(paths.has(p), `${p} is not editable in the builder`).toBe(true);
      }
    });

    it(`${id}: the section is reachable and switchable`, () => {
      // Design+ scrolls to a group's section by id, and silently skips one that
      // does not exist; the toggle is what lets a couple drop the block.
      expect(tpl.sectionIds, 'place is missing from sectionIds').toContain('place');
      expect(tpl.fields.some((f) => f.path === 'hidden.place'), 'no visibility switch').toBe(true);
      expect(src).toContain('data-opt="place"');
    });

    it(`${id}: its two strings exist in every language`, () => {
      // A missing data-t key renders as an empty element, so the kicker and the
      // button's label would simply vanish in that language.
      for (const key of ['howToFindUs', 'openMap']) {
        const found = [...src.matchAll(new RegExp(`\\b${key}:`, 'g'))].length;
        expect(found, `${key} is not in all three dictionaries`).toBe(3);
      }
    });
  }
});

describe('every data-bind in a template has a key to fill it', () => {
  /**
   * The gap that let the venue name and address ship blank.
   *
   * `bindTexts` builds one object of `data-bind` key → text and then does
   * `if (v != null) el.textContent = v`. A key that is not in that object is
   * therefore NOT an error and NOT empty text — the element is skipped and keeps
   * whatever it was authored with, which for these is nothing at all. So the
   * markup was right, the field was declared, the editor accepted the value, and
   * the page rendered an empty heading. Nothing anywhere said so.
   *
   * Checked across every template, not just the four: it is a property of how
   * `bindTexts` works, so any template can fall into it.
   */
  for (const tpl of RICH_TEMPLATES) {
    const src = read(tpl.id);
    it(tpl.id, () => {
      const used = new Set([...src.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]));
      const at = src.indexOf('var map = {');
      expect(at, 'bindTexts no longer builds a map').toBeGreaterThan(-1);
      // The object literal, brace-matched — the keys it defines are what can be
      // bound. Comments stripped so prose mentioning a key does not count.
      let depth = 0; let end = at;
      for (let i = src.indexOf('{', at); i < src.length; i += 1) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
      }
      const body = src.slice(at, end).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      const defined = new Set([...body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]));
      const orphans = [...used].filter((k) => !defined.has(k));
      expect(
        orphans,
        `these data-bind keys are never filled, so the element renders exactly as `
        + `authored — empty: ${orphans.join(', ')}`,
      ).toEqual([]);
    });
  }
});
