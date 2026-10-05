import { describe, expect, it } from 'vitest';
import {
  HEIC_EXTENSIONS, hasHeicExtension, isHeicBuffer, jpegName, storedExtension,
} from './heic.js';
import { IMAGE_EXTENSIONS, isAllowedImage } from './imageUpload.js';

// ── Recognising a HEIC ──────────────────────────────────────────────────────
// These uploads were already ACCEPTED — that was never the bug. They were
// stored as `.heic`, and no browser but Safari draws one, so the photo uploaded
// and the page showed a broken image. Everything here is about deciding, from
// the bytes, which files have to be re-encoded.

/**
 * A `ftyp` box, as every ISO base-media file opens with: a big-endian length,
 * the literal `ftyp`, a major brand, a minor version, then compatible brands.
 * Built rather than loaded from a fixture so each case states exactly which
 * part of the header it is about.
 */
function ftyp(major: string, compatible: string[] = [], trailing = 'mdat'): Buffer {
  const size = 16 + compatible.length * 4;
  const head = Buffer.alloc(size);
  head.writeUInt32BE(size, 0);
  head.write('ftyp', 4, 'latin1');
  head.write(major, 8, 'latin1');
  head.writeUInt32BE(0, 12);
  compatible.forEach((brand, index) => head.write(brand, 16 + index * 4, 'latin1'));
  return Buffer.concat([head, Buffer.from(trailing, 'latin1')]);
}

// The real `ftyp` box of an iPhone photo (IMG_2420.HEIC), and a real AVIF
// produced by libvips. Only the headers, so nothing here is a photograph — but
// the bytes are genuine, and the AVIF one is the case that matters: hand-written
// headers are a test of what I THINK these formats look like.
const REAL_IPHONE_FTYP = Buffer.from('AAAAKGZ0eXBoZWljAAAAAG1pZjFNaUhFTWlQcm1pYWZNaUhCaGVpYw==', 'base64');
const REAL_AVIF = Buffer.from(
  'AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAA'
  + 'AAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAACUAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAA'
  + 'AA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAEAAAAAwAAAAEHBpeGkAAAAA'
  + 'AwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAtbWRhdBIACgk4FX+9pAQ0GkAyFhlCYwTAADQAAJfK4Krbwr+S0pFYjj4=',
  'base64',
);

describe('what counts as a HEIC', () => {
  it('recognises the header an iPhone actually writes', () => {
    // The real bytes: major brand `heic`, compatible brands
    // `mif1 MiHE MiPr miaf MiHB heic`.
    expect(REAL_IPHONE_FTYP.toString('latin1', 4, 8)).toBe('ftyp');
    expect(isHeicBuffer(REAL_IPHONE_FTYP)).toBe(true);
  });

  it('recognises a HEIF whose MAJOR brand is the generic one', () => {
    // Some cameras and conversions put `mif1` in the major slot and the codec
    // brand in the compatible list; reading only the major brand misses those.
    expect(isHeicBuffer(ftyp('mif1', ['heic']))).toBe(true);
  });

  it('recognises the multi-image and sequence brands a Live Photo produces', () => {
    // `msf1` is deliberately absent: it is a GENERIC HEIF brand that an AVIF
    // sequence carries too, so it belongs with `mif1` and settles nothing.
    for (const brand of ['heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']) {
      expect(isHeicBuffer(ftyp(brand))).toBe(true);
    }
  });

  it('is case-insensitive about the brand', () => {
    expect(isHeicBuffer(ftyp('HEIC'))).toBe(true);
  });

  it('leaves a REAL AVIF alone, though it carries `mif1` like a HEIC does', () => {
    // The case that makes the brand rule a veto rather than a list. A real AVIF
    // is `ftypavif` + compatible brands `mif1 avif miaf` — so treating the
    // generic HEIF brands as sufficient marks every AVIF as HEIC, sends it to a
    // decoder that cannot read it, and 415s an upload that works today.
    expect(REAL_AVIF.toString('latin1', 16, 20)).toBe('mif1');
    expect(isHeicBuffer(REAL_AVIF)).toBe(false);
    expect(isHeicBuffer(ftyp('avis', ['mif1']))).toBe(false);
  });

  it('refuses to convert a file claiming BOTH avif and heic', () => {
    // The only case where the AVIF veto actually decides anything, and the
    // reason it is a veto rather than an absence: without it, a brand list
    // carrying both families falls through to the HEVC check and an AVIF is
    // handed to a decoder that cannot read it. It is also what keeps the
    // behaviour safe if `mif1` is ever added to the HEVC list to catch more
    // HEICs — a change that would otherwise silently break every AVIF.
    expect(isHeicBuffer(ftyp('avif', ['mif1', 'heic']))).toBe(false);
    expect(isHeicBuffer(ftyp('heic', ['mif1', 'avif']))).toBe(false);
  });

  it('reads brands ONLY out of a real ftyp box', () => {
    // Without the `ftyp` check, these same four bytes at the same offset would
    // be read as a brand out of any binary that happened to contain them.
    const notIso = Buffer.alloc(32);
    notIso.writeUInt32BE(32, 0);
    notIso.write('junk', 4, 'latin1');   // where `ftyp` would be
    notIso.write('heic', 8, 'latin1');   // where the major brand would be
    notIso.write('heic', 16, 'latin1');  // and a compatible brand
    expect(isHeicBuffer(notIso)).toBe(false);
  });

  it('is not fooled by `mif1` alone, in either slot', () => {
    // Generic HEIF with no codec brand says nothing about whether a browser can
    // draw it, so it is left alone — refusing a working upload is the worse
    // mistake, and a genuine HEIC that gets this far is still caught by its
    // extension when it is served.
    expect(isHeicBuffer(ftyp('mif1'))).toBe(false);
    expect(isHeicBuffer(ftyp('msf1', ['mif1']))).toBe(false);
  });

  it('leaves an MP4 alone', () => {
    expect(isHeicBuffer(ftyp('isom', ['iso2', 'avc1', 'mp41']))).toBe(false);
    expect(isHeicBuffer(ftyp('qt  '))).toBe(false);
  });

  it('says no to a JPEG, a PNG and a GIF', () => {
    expect(isHeicBuffer(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]))).toBe(false);
    expect(isHeicBuffer(Buffer.from('\x89PNG\r\n\x1a\nIHDR12345678', 'latin1'))).toBe(false);
    expect(isHeicBuffer(Buffer.from('GIF89a' + 'x'.repeat(20), 'latin1'))).toBe(false);
  });

  it('says no to something far too short to have a header', () => {
    for (const bytes of [Buffer.alloc(0), Buffer.alloc(4), Buffer.alloc(15)]) {
      expect(isHeicBuffer(bytes)).toBe(false);
    }
  });
});

describe('the bytes decide, not the name', () => {
  // This is the whole reason detection reads the header. Neither thing a browser
  // hands us is reliable: iOS often sends `application/octet-stream`, and some
  // apps share a HEIC under a `.jpg` name.

  it('converts a HEIC that calls itself a JPEG', () => {
    // Trusting the extension here would store it unconverted and reproduce the
    // original bug on a file that looks perfectly ordinary.
    const heicBytes = ftyp('heic', ['mif1']);
    expect(isHeicBuffer(heicBytes)).toBe(true);
    expect(storedExtension('holiday.jpg', true)).toBe('.jpg');
  });

  it('does NOT convert a real JPEG that calls itself a HEIC', () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
    expect(isHeicBuffer(jpegBytes)).toBe(false);
    // It keeps the name it arrived with — this function converts one format.
    expect(storedExtension('holiday.heic', false)).toBe('.heic');
  });

  it('cannot be walked off the end of the buffer by a lying box length', () => {
    // A crafted header claiming a huge box must not make the scan read past what
    // multer actually buffered.
    const evil = ftyp('isom', ['iso2']);
    evil.writeUInt32BE(0xffffffff, 0);
    expect(() => isHeicBuffer(evil)).not.toThrow();
    expect(isHeicBuffer(evil)).toBe(false);

    const zero = ftyp('heic');
    zero.writeUInt32BE(0, 0);
    // A zero length is ignored rather than trusted, and the major brand is still read.
    expect(isHeicBuffer(zero)).toBe(true);
  });
});

describe('what the stored file is called', () => {
  it('REPLACES the extension rather than appending one', () => {
    // `IMG_2420.HEIC.jpg` would be served correctly and read as a mistake; worse,
    // keeping `.HEIC` on JPEG bytes is a name that lies, which is the bug being
    // fixed pointed the other way.
    expect(jpegName('IMG_2420.HEIC')).toBe('IMG_2420.jpg');
    expect(jpegName('holiday.heif')).toBe('holiday.jpg');
  });

  it('gives an extensionless file one', () => {
    // The static server picks the Content-Type from the extension; without one a
    // browser downloads the file instead of drawing it.
    expect(jpegName('photo')).toBe('photo.jpg');
    expect(storedExtension('photo', false)).toBe('.jpg');
  });

  it('handles a name that is nothing but an extension', () => {
    expect(jpegName('.heic')).toBe('photo.jpg');
  });

  it('lower-cases what it keeps, so one photo cannot be stored two ways', () => {
    expect(storedExtension('HOLIDAY.PNG', false)).toBe('.png');
  });

  it('stores a converted file as .jpg whatever it was called', () => {
    for (const name of ['IMG_1.HEIC', 'a.heif', 'b.hif', 'c.jpg', 'd']) {
      expect(storedExtension(name, true)).toBe('.jpg');
    }
  });
});

describe('the extension lists stay in step', () => {
  it('every HEIC extension is one the uploads accept', () => {
    // `isAllowedImage` is the gate; a HEIC extension it does not list would be
    // refused at the door and never reach the converter at all.
    for (const extension of HEIC_EXTENSIONS) {
      expect(IMAGE_EXTENSIONS).toContain(extension);
      expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: `x${extension}` })).toBe(true);
    }
  });

  it('recognises a HEIC extension whatever its case', () => {
    expect(hasHeicExtension('/uploads/shared/menu/IMG_2420.HEIC')).toBe(true);
    expect(hasHeicExtension('/uploads/shared/menu/a.heif')).toBe(true);
    expect(hasHeicExtension('/uploads/shared/menu/a.jpg')).toBe(false);
  });

  it('accepts an octet-stream HEIC, which is what iOS actually sends', () => {
    expect(isAllowedImage({ mimetype: 'application/octet-stream', originalname: 'IMG_2420.HEIC' })).toBe(true);
  });
});
