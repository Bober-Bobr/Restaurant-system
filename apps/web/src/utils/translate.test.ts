import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate, locales, defaultLocale } from './translate';

// ── Every string has to exist in all three languages ────────────────────────
// `TranslationKey` is derived from `resources.en` alone, so a key missing from
// `ru` or `uz` is NOT a type error: it compiles, ships, and shows the wrong
// language to a real user. That gap is exactly what this file closes, which is
// why it reads the source rather than the exported function — the runtime
// fallback would hide the very thing being looked for.

const SOURCE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'translate.ts'), 'utf8');

/** The keys defined inside one locale block of `resources`. */
function keysOf(locale: string): string[] {
  const start = SOURCE.indexOf(`\n  ${locale}: {`);
  if (start < 0) throw new Error(`no ${locale} block in translate.ts`);
  const end = SOURCE.indexOf('\n  },', start);
  const body = SOURCE.slice(start, end < 0 ? SOURCE.length : end);
  return [...body.matchAll(/^ {4}([a-zA-Z0-9_]+):/gm)].map((m) => m[1]);
}

const KEYS = Object.fromEntries(locales.map((l) => [l, keysOf(l)])) as Record<string, string[]>;

describe('the translation table', () => {
  it('has a substantial number of strings in English', () => {
    // A guard on the parser above: if it silently matched nothing, every
    // comparison below would pass vacuously.
    expect(KEYS.en.length).toBeGreaterThan(500);
  });

  for (const locale of locales) {
    it(`defines no key twice in ${locale}`, () => {
      // A duplicate key silently wins over the earlier one — the string that
      // was edited may not be the string that renders.
      const seen = new Set<string>();
      const duplicates = KEYS[locale].filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
      expect(duplicates).toEqual([]);
    });
  }

  for (const locale of locales.filter((l) => l !== 'en')) {
    it(`translates every English key into ${locale}`, () => {
      const missing = KEYS.en.filter((k) => !KEYS[locale].includes(k));
      expect(missing).toEqual([]);
    });

    it(`has no ${locale} key that English does not have`, () => {
      // A leftover key is dead weight, and usually means a rename went halfway.
      const extra = KEYS[locale].filter((k) => !KEYS.en.includes(k));
      expect(extra).toEqual([]);
    });
  }

  for (const locale of locales) {
    it(`has no blank string in ${locale}`, () => {
      // A visible key is a bug report; an empty label is a mystery — the button
      // just has no text on it.
      const start = SOURCE.indexOf(`\n  ${locale}: {`);
      const body = SOURCE.slice(start, SOURCE.indexOf('\n  }', start + 10));
      const blanks = [...body.matchAll(/^ {4}([a-zA-Z0-9_]+): '(\s*)',/gm)].map(([, key]) => key);
      expect(blanks).toEqual([]);
    });
  }
});

describe('looking a string up', () => {
  it('returns the requested language', () => {
    expect(translate('menu', 'en')).toBe('Menu');
    expect(translate('menu', 'ru')).not.toBe(translate('menu', 'en'));
  });

  it('falls back to Uzbek, not English, for an unknown locale', () => {
    // The product's users are Uzbek-speaking; English is the development
    // language, not the safest default in front of a guest.
    expect(defaultLocale).toBe('uz');
    expect(translate('menu', 'de' as never)).toBe(translate('menu', 'uz'));
  });

  it('returns the key itself rather than blank when a string is missing', () => {
    // A visible key is a bug report; an empty label is a mystery.
    expect(translate('no_such_key_at_all' as never, 'en')).toBe('no_such_key_at_all');
  });

  it('substitutes parameters, every occurrence', () => {
    const withParam = Object.entries(
      // Find a real key whose English text has a placeholder, so the test is
      // about the substitution rather than about one hard-coded string.
      Object.fromEntries([...SOURCE.matchAll(/^ {4}([a-zA-Z0-9_]+): '([^']*\{[a-z]+\}[^']*)'/gm)].map((m) => [m[1], m[2]])),
    )[0];
    expect(withParam).toBeTruthy();
    const [key, text] = withParam!;
    const param = /\{([a-z]+)\}/.exec(text)![1];
    const rendered = translate(key as never, 'en', { [param]: 'XYZ' });
    expect(rendered).toContain('XYZ');
    expect(rendered).not.toContain(`{${param}}`);
  });
});

describe('the prefixed families each product uses', () => {
  // Prefixes keep three products' strings from colliding in one table.
  const FAMILIES = {
    fs_: 'the guest-facing food-service site',
    fe_: 'the food-employee floor app',
  };

  for (const [prefix, what] of Object.entries(FAMILIES)) {
    it(`${prefix}* (${what}) exists in all three languages`, () => {
      const family = KEYS.en.filter((k) => k.startsWith(prefix));
      expect(family.length).toBeGreaterThan(5);
      for (const locale of locales) {
        expect(family.filter((k) => !KEYS[locale].includes(k))).toEqual([]);
      }
    });
  }
});
