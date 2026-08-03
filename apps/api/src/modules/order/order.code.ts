import { randomBytes, randomInt } from 'node:crypto';

// ── The handoff code ────────────────────────────────────────────────────────
// Three characters, because a guest has to read it aloud across a table and a
// waiter has to type it on a phone. That shortness drives everything here.
//
// The alphabet omits every character that is misread on a screen or misheard
// when spoken: 0/O, 1/I/L, 5/S, 8/B, 2/Z. What remains is 25 symbols → 15,625
// codes. That is ample, because codes only have to be unambiguous among the
// orders still claimable in ONE restaurant at one moment — a partial unique
// index enforces exactly that, and a code is reusable once its order closes.
const ALPHABET = '34679ACDEFGHJKMNPQRTUVWXY';

export const CODE_LENGTH = 3;

export function generateCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += ALPHABET[randomInt(ALPHABET.length)]!;
  return out;
}

/**
 * Tidy what a waiter typed: case and stray punctuation only.
 *
 * Deliberately does NOT "correct" excluded characters onto similar-looking ones.
 * A code identifies a real order belonging to a real guest, so silently folding
 * a typed O onto some other character risks claiming somebody else's order —
 * far worse than asking the waiter to retype three characters.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** True when the string could be one of our codes at all. */
export function isPlausibleCode(input: string): boolean {
  const code = normalizeCode(input);
  return code.length === CODE_LENGTH && [...code].every((c) => ALPHABET.includes(c));
}

/**
 * The guest's device token. Long, random, never displayed — the only thing
 * proving an anonymous browser owns an order, so it must not be guessable the
 * way a three-character code trivially is.
 */
export function generateGuestToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Exposed for tests. */
export const CODE_ALPHABET = ALPHABET;
