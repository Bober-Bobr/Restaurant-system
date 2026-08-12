import { describe, expect, it } from 'vitest';
import { MenuCategory } from '@prisma/client';
import { toSubdomainSlug } from './slug.js';
import { formatSom, tiyinToSom } from './currency.js';
import { parseExcludedCategories } from './excludedCategories.js';
import { isAllowedImage, IMAGE_EXTENSIONS } from './imageUpload.js';

describe('restaurant slugs', () => {
  // Slugs are derived from the name rather than stored, so the same rules have
  // to produce the same answer on both sides — see the lockstep test in the web
  // suite, which runs this exact table through the browser's copy.
  it('lower-cases and hyphenates', () => {
    expect(toSubdomainSlug('Registon Palace')).toBe('registon-palace');
    expect(toSubdomainSlug('REGISTON')).toBe('registon');
    expect(toSubdomainSlug('Registon_Palace')).toBe('registon-palace');
  });

  it('drops anything that cannot appear in a hostname', () => {
    // Accents and punctuation are removed rather than transliterated, and a
    // dropped word leaves its hyphens behind ("& " → "--"). Ugly but stable,
    // and the web copy does exactly the same — which is the property that
    // matters, since one builds the URL and the other resolves it.
    expect(toSubdomainSlug("Registon's Café & Co.")).toBe('registons-caf--co');
    expect(toSubdomainSlug('Ресторан Регистон')).toBe('restaurant'); // nothing survives → fallback
  });

  it('collapses runs of spaces and trims stray hyphens', () => {
    expect(toSubdomainSlug('  Registon   Palace  ')).toBe('registon-palace');
    expect(toSubdomainSlug('---Registon---')).toBe('registon');
  });

  it('never returns an empty slug', () => {
    // An empty first path segment would resolve to the login page instead.
    for (const name of ['', '   ', '!!!', '###']) expect(toSubdomainSlug(name)).toBe('restaurant');
  });

  it('stays inside the 63-character hostname label limit', () => {
    expect(toSubdomainSlug('a'.repeat(200))).toHaveLength(63);
  });

  it('is idempotent — slugging a slug changes nothing', () => {
    for (const name of ['Registon Palace', "Registon's Café", 'a'.repeat(200)]) {
      const once = toSubdomainSlug(name);
      expect(toSubdomainSlug(once)).toBe(once);
    }
  });
});

describe('money is counted in tiyin', () => {
  it('renders whole so\'m with a thousands separator', () => {
    // 1 so'm = 100 tiyin, so 450 000 000 tiyin is 4 500 000 so'm. The separator
    // is a NON-BREAKING space (U+00A0) from the ru-RU locale — a price must not
    // wrap in the middle of a number.
    expect(formatSom(450000000)).toBe("4\u00a0500\u00a0000 so'm");
  });

  it('converts to whole so\'m for spreadsheet cells', () => {
    expect(tiyinToSom(450000000)).toBe(4500000);
    expect(tiyinToSom(0)).toBe(0);
  });

  it('rounds rather than truncating a stray half-tiyin', () => {
    expect(tiyinToSom(150)).toBe(2);
    expect(tiyinToSom(149)).toBe(1);
  });
});

describe('excluded menu categories are parsed defensively', () => {
  // The column is free-form JSON written by an earlier version of the app, so
  // every shape it could hold has to degrade to "nothing is excluded" rather
  // than throwing on the first page load.
  it('reads a normal list', () => {
    expect(parseExcludedCategories('["SUSHI_ROLLS","ALCOHOL"]')).toEqual([MenuCategory.SUSHI_ROLLS, MenuCategory.ALCOHOL]);
  });

  it('treats missing or empty as nothing excluded', () => {
    for (const raw of [null, undefined, '']) expect(parseExcludedCategories(raw)).toEqual([]);
  });

  it('survives malformed JSON', () => {
    expect(parseExcludedCategories('{not json')).toEqual([]);
  });

  it('ignores a value that is not a list', () => {
    expect(parseExcludedCategories('{"a":1}')).toEqual([]);
    expect(parseExcludedCategories('"SOUPS"')).toEqual([]);
  });

  it('drops entries that are not real categories', () => {
    // A category renamed in a later migration must not crash the menu query.
    expect(parseExcludedCategories('["SOUPS","BURGERS",42,null]')).toEqual([MenuCategory.SOUPS]);
  });
});

describe('image uploads', () => {
  it('accepts anything the browser labels as an image', () => {
    expect(isAllowedImage({ mimetype: 'image/png', originalname: 'a.png' })).toBe(true);
    expect(isAllowedImage({ mimetype: 'image/webp', originalname: 'a.webp' })).toBe(true);
  });

  it('accepts a phone photo that arrives as a nameless binary', () => {
    // HEIC/HEIF and AVIF come through as application/octet-stream from some
    // devices, which is why the extension is a second chance rather than a
    // second requirement.
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'IMG_0001.HEIC' })).toBe(true);
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'photo.avif' })).toBe(true);
  });

  it('is case-insensitive about the extension', () => {
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'PHOTO.JPG' })).toBe(true);
  });

  it('refuses an executable dressed as an upload', () => {
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'payload.exe' })).toBe(false);
    expect(isAllowedImage({ mimetype: 'application/x-sh', originalname: 'run.sh' })).toBe(false);
    expect(isAllowedImage({ mimetype: 'text/html', originalname: 'page.html' })).toBe(false);
  });

  it('refuses a file with no extension and no image type', () => {
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'README' })).toBe(false);
  });

  it('lists its extensions with the leading dot, lower-cased', () => {
    for (const ext of IMAGE_EXTENSIONS) expect(ext).toMatch(/^\.[a-z0-9]+$/);
  });
});
