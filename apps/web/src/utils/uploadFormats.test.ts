import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGE_ACCEPT } from './uploadFormats';
import { IMAGE_EXTENSIONS } from '../../../api/src/utils/imageUpload';
import { HEIC_EXTENSIONS } from '../../../api/src/utils/heic';

// ── The picker and the gate have to agree ───────────────────────────────────
// `IMAGE_ACCEPT` decides what a file dialog OFFERS; `IMAGE_EXTENSIONS` decides
// what the API ACCEPTS. They are in two projects that cannot import each other
// at runtime, so this test imports both — the same guard already standing over
// `toSubdomainSlug`, the invoice arithmetic and the section rule.
//
// A drift either way is a bad day: an extension only the picker knows gets a
// photo chosen and then refused at upload, and one only the API knows is a
// format the product accepts but no one can select.

const accepted = IMAGE_ACCEPT.split(',').map((entry) => entry.trim()).filter((entry) => entry.startsWith('.'));

describe('the picker offers exactly what the API accepts', () => {
  it('offers nothing the API would refuse', () => {
    for (const extension of accepted) expect(IMAGE_EXTENSIONS).toContain(extension);
  });

  it('hides nothing the API would accept', () => {
    for (const extension of IMAGE_EXTENSIONS) expect(accepted).toContain(extension);
  });

  it('still leads with `image/*`, which is what most browsers actually read', () => {
    // The explicit extensions are there because several OS dialogs hide HEIC and
    // AVIF without them — they are an addition to `image/*`, not a replacement.
    expect(IMAGE_ACCEPT.startsWith('image/*,')).toBe(true);
  });

  it('offers every HEIC extension', () => {
    // An iPhone photographs in HEIC. A dialog that hides it is a photo nobody
    // can even choose.
    for (const extension of HEIC_EXTENSIONS) expect(accepted).toContain(extension);
  });
});

// ── Every picker uses it ────────────────────────────────────────────────────
// Four pickers carried a bare `accept="image/*"` — a performer's avatar and
// gallery, a restaurant's extra-service photos, and the Additional Services
// form — which is the case this constant exists to prevent, on exactly the
// screens a guest reaches from a phone.

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== 'node_modules') sourceFiles(full, found);
    } else if (entry.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

describe('no picker hard-codes its own accept list', () => {
  it('every image file input reads IMAGE_ACCEPT', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(join(__dirname, '..'))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/accept=(?:"([^"]*)"|\{([^}]*)\})/g)) {
        const value = match[1] ?? match[2] ?? '';
        // Video and audio pickers have their own formats and are not this
        // constant's business.
        if (/video|audio/.test(value)) continue;
        // A prop threaded down from a caller is fine — the caller is checked.
        if (/^\s*accept\s*$/.test(value)) continue;
        if (!value.includes('IMAGE_ACCEPT')) offenders.push(`${file.split('/src/')[1]}: accept=${match[0].slice(7)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
