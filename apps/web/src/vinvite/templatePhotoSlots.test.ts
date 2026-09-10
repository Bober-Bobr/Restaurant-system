import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_TEMPLATES } from './templates';

/**
 * A bundled plate the honoree may replace — the ceremony photograph, so a couple
 * can show the venue they are actually marrying in.
 *
 * The artwork in these designs is part of the design and ships bundled; the
 * ceremony plate is the exception, marked in the markup with
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
