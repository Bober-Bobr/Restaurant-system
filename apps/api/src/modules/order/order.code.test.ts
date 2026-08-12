import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET, CODE_LENGTH, generateCode, generateGuestToken, isPlausibleCode, normalizeCode,
} from './order.code.js';

// The two identifiers an order carries do opposite jobs: the code is spoken
// across a table, the guest token proves ownership. Confusing them is how an
// anonymous guest ends up able to read somebody else's order.

describe('the spoken order code', () => {
  it('is three characters', () => {
    expect(CODE_LENGTH).toBe(3);
    for (let i = 0; i < 200; i += 1) expect(generateCode()).toHaveLength(3);
  });

  it('omits every character that is misread or misheard', () => {
    // 0/O, 1/I/L, 5/S, 8/B, 2/Z — a guest reads this aloud and a waiter types it.
    for (const glyph of ['0', 'O', '1', 'I', 'L', '5', 'S', '8', 'B', '2', 'Z']) {
      expect(CODE_ALPHABET).not.toContain(glyph);
    }
  });

  it('only ever generates characters from that alphabet', () => {
    for (let i = 0; i < 500; i += 1) {
      for (const char of generateCode()) expect(CODE_ALPHABET).toContain(char);
    }
  });

  it('does not always produce the same code', () => {
    const seen = new Set(Array.from({ length: 300 }, () => generateCode()));
    // 25³ = 15,625 codes; 300 draws collapsing to a handful would mean a broken RNG.
    expect(seen.size).toBeGreaterThan(200);
  });
});

describe('normalizing what the waiter typed', () => {
  it('accepts lower case and stray punctuation', () => {
    expect(normalizeCode(' a3f ')).toBe('A3F');
    expect(normalizeCode('a-3-f')).toBe('A3F');
    expect(normalizeCode('A3F.')).toBe('A3F');
  });

  it('does NOT fold an excluded character onto a similar-looking one', () => {
    // The dangerous "helpful" behaviour: silently turning a typed O into a 0
    // (or an I into a J) could claim a different guest's order. Better to ask
    // for three characters again.
    expect(normalizeCode('O3F')).toBe('O3F');
    expect(isPlausibleCode('O3F')).toBe(false);
    expect(normalizeCode('1AB')).toBe('1AB');
    expect(isPlausibleCode('1AB')).toBe(false);
  });

  it('rejects anything that is not a code at all', () => {
    expect(isPlausibleCode('')).toBe(false);
    expect(isPlausibleCode('AB')).toBe(false);
    expect(isPlausibleCode('ABCD')).toBe(false);
    expect(isPlausibleCode('!!!')).toBe(false);
  });

  it('accepts every code it generates', () => {
    for (let i = 0; i < 200; i += 1) expect(isPlausibleCode(generateCode())).toBe(true);
  });

  it('accepts a generated code typed back in lower case', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateCode();
      expect(isPlausibleCode(code.toLowerCase())).toBe(true);
      expect(normalizeCode(code.toLowerCase())).toBe(code);
    }
  });
});

describe('the guest device token', () => {
  it('is long enough not to be guessable, unlike the code', () => {
    // It is the ONLY thing proving an anonymous browser owns an order.
    const token = generateGuestToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('is URL-safe, since it travels in a path', () => {
    for (let i = 0; i < 100; i += 1) expect(generateGuestToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateGuestToken()));
    expect(seen.size).toBe(1000);
  });

  it('is not the kind of thing a guest could read out', () => {
    expect(generateGuestToken().length).toBeGreaterThan(CODE_LENGTH * 5);
  });
});
