import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLogoBuffer } from './pdf.service.js';

/**
 * Exported PDFs and spreadsheets carry the restaurant's logo. The loader used
 * to fall back to a bundled `src/assets/logo.png` whenever the restaurant's own
 * logo could not be resolved — and that file was ONE RESTAURANT'S logo, checked
 * into the repo. So every other tenant's invoice went out under that
 * restaurant's brand, which is what was reported.
 *
 * The fallback is gone. A document with no logo is merely plain; a document
 * carrying another company's mark is wrong, and is the kind of thing a customer
 * notices before we do.
 */
const API_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const UPLOADS = path.join(API_ROOT, 'uploads');
const FIXTURE_DIR = path.join(UPLOADS, '__logo_test__');
const FIXTURE = path.join(FIXTURE_DIR, 'own.png');
const BYTES = Buffer.from('89504e470d0a1a0a-not-a-real-png-but-distinctive', 'utf8');

beforeAll(() => {
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  fs.writeFileSync(FIXTURE, BYTES);
});
afterAll(() => {
  fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
});

describe('a document only ever carries its own restaurant logo', () => {
  it('loads the restaurant\'s own logo from its upload path', () => {
    // The thing that must keep working: a restaurant WITH a logo gets it.
    return expect(loadLogoBuffer('/uploads/__logo_test__/own.png')).resolves.toEqual(BYTES);
  });

  it('returns nothing when the restaurant has no logo', async () => {
    // Previously: the bundled logo of an unrelated restaurant.
    for (const missing of [null, undefined, '']) {
      expect(await loadLogoBuffer(missing), String(missing)).toBeNull();
    }
  });

  it('returns nothing when the stored path points at a file that is gone', async () => {
    // The common case behind the report — a logo record whose file moved, or a
    // caller that sent a path from a different install.
    expect(await loadLogoBuffer('/uploads/__logo_test__/does-not-exist.png')).toBeNull();
  });

  it('returns nothing for a path outside the uploads directory', async () => {
    // Traversal is refused rather than falling back to anything.
    expect(await loadLogoBuffer('/uploads/../../../etc/passwd')).toBeNull();
    expect(await loadLogoBuffer('not-an-upload-path')).toBeNull();
  });

  it('ships no bundled logo for anything to fall back to', () => {
    // The asset itself is deleted. If it comes back, the fallback can too.
    for (const p of [
      path.join(API_ROOT, 'src', 'assets', 'logo.png'),
      path.join(API_ROOT, 'src', 'assets'),
    ]) {
      expect(fs.existsSync(p), `${p} is back — that is where the wrong logo came from`).toBe(false);
    }
  });

  it('the loader source names no fallback image', () => {
    // Cheap, and it catches a fallback reintroduced from a different path.
    const src = fs.readFileSync(
      path.join(API_ROOT, 'src', 'modules', 'public', 'pdf.service.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');   // strip the comments explaining this
    expect(src).not.toMatch(/assets/);
    expect(src).not.toMatch(/logo\.png/);
  });
});
