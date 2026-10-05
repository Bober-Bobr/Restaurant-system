import path from 'path';

/**
 * Recognising a HEIC photo, and deciding what to call it once converted.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * An iPhone photographs in HEIC by default. The uploads already ACCEPTED it
 * (`isAllowedImage` lets it through by extension, because iOS often sends it as
 * `application/octet-stream`), so the file landed on disk and the URL went into
 * the database — and then **no browser except Safari would draw it**. The photo
 * uploaded and the page showed a broken image, which is exactly how it was
 * reported.
 *
 * The fix is to store a JPEG instead, so nothing downstream has to know HEIC
 * exists. This file is the pure half: what counts as HEIC and what the converted
 * file is called. The conversion itself is in `heicConvert.ts`, because it needs
 * a worker thread.
 *
 * ── DETECTION IS BY MAGIC BYTES, NOT BY NAME ───────────────────────────────
 * Neither of the two things a browser hands us can be trusted:
 *   · the EXTENSION — iOS shares the same photo as `.heic`, `.HEIC` or, through
 *     some apps, `image.jpg` with HEIC bytes inside it;
 *   · the MIME TYPE — iOS frequently sends `application/octet-stream`, and some
 *     Android browsers label a HEIC `image/jpeg`.
 * A file that LIES about being a JPEG is the interesting case: trusting the name
 * would store it unconverted and reproduce the original bug. The bytes cannot
 * lie, so the bytes decide.
 */

/**
 * The brands that mean "HEVC-coded still image" — the ones only Safari draws.
 *
 * `heic`/`heix`/`hevc`/`hevx` are what Apple writes; `heim`/`heis`/`hevm`/`hevs`
 * are the multi-image and sequence variants a Live Photo or a burst produces.
 */
const HEVC_BRANDS = [
  'heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs',
] as const;

/**
 * AVIF. **The same container, a different codec, and every current browser
 * draws one natively** — so an AVIF must never be sent to the HEIC decoder.
 *
 * This list is a VETO rather than an absence, and that distinction is the whole
 * of the bug it fixes: a real AVIF lists `mif1` among its compatible brands, so
 * treating the generic HEIF brands as sufficient marked every AVIF as HEIC. The
 * decoder would then refuse it and the upload would 415 — a format that works
 * today breaking because of a change meant to fix a different one.
 */
const AVIF_BRANDS = ['avif', 'avis'] as const;

/**
 * The generic HEIF brands. Present in HEIC *and* AVIF, so on their own they
 * settle nothing — which is exactly why they are kept apart from `HEVC_BRANDS`.
 */
const GENERIC_BRANDS = ['mif1', 'msf1'] as const;

/** Extensions that *claim* to be HEIC. Used for naming and for the serve-time path, never for detection. */
export const HEIC_EXTENSIONS = ['.heic', '.heif', '.hif'];

/**
 * Whether these bytes are a HEIF still image.
 *
 * An ISO base-media file opens with a `ftyp` box: a four-byte big-endian length,
 * the literal `ftyp`, then the major brand, then a list of compatible brands.
 * The major brand alone is not enough — iPhones write `heic` as the major brand,
 * but some cameras and conversions write the generic `mif1` there and put `heic`
 * in the compatible list — so the whole brand list is read.
 */
export function isHeicBuffer(buffer: Buffer): boolean {
  const brands = ftypBrands(buffer);
  if (brands.length === 0) return false;

  // AVIF wins outright, wherever it appears. A real AVIF carries `mif1` too, so
  // without this veto the generic brand below would claim it.
  if (brands.some((brand) => (AVIF_BRANDS as readonly string[]).includes(brand))) return false;

  // An explicit HEVC-still brand anywhere in the list settles it — including the
  // files that put the generic `mif1` in the MAJOR slot and the codec brand in
  // the compatible list, which some cameras and conversions do.
  if (brands.some((brand) => (HEVC_BRANDS as readonly string[]).includes(brand))) return true;

  // Only the generic brands left, and nothing saying which codec. Treated as
  // NOT HEIC: guessing wrong here refuses a working upload, whereas a genuine
  // HEIC that gets this far is still caught by its extension when it is served.
  return false;
}

/** The major brand plus every compatible brand of a `ftyp` box, lower-cased. */
function ftypBrands(buffer: Buffer): string[] {
  // 4 length + 4 'ftyp' + 4 major brand + 4 minor version = 16 to be worth reading.
  if (!buffer || buffer.length < 16) return [];
  if (buffer.toString('latin1', 4, 8) !== 'ftyp') return [];

  const declared = buffer.readUInt32BE(0);
  // A box length may legitimately be longer than what multer buffered, so the
  // scan is bounded by BOTH; a zero or absurd length is ignored rather than
  // trusted, or a crafted header could walk us off the end of the buffer.
  const end = declared >= 16 && declared <= buffer.length ? declared : Math.min(buffer.length, 64);

  const brands = [buffer.toString('latin1', 8, 12).toLowerCase()];
  for (let at = 16; at + 4 <= end; at += 4) {
    brands.push(buffer.toString('latin1', at, at + 4).toLowerCase());
  }
  return brands;
}

/** Exported for the tests: the three brand groups, so none can drift unnoticed. */
export const BRANDS = { hevc: HEVC_BRANDS, avif: AVIF_BRANDS, generic: GENERIC_BRANDS };

/** Whether a stored path claims to be HEIC — for the already-uploaded files. */
export function hasHeicExtension(name: string): boolean {
  return HEIC_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

/**
 * What a converted file is called.
 *
 * The extension is REPLACED rather than appended: `photo.heic.jpg` would be
 * served correctly but reads as a mistake, and `IMG_2420.HEIC` must not become
 * `IMG_2420.HEIC` with JPEG inside — a name that lies is the bug this is fixing,
 * pointed the other way.
 *
 * A name with no extension at all still gets `.jpg`, because the static server
 * picks the Content-Type from the extension and an extensionless file is sent as
 * `application/octet-stream`, which a browser downloads instead of drawing.
 */
export function jpegName(originalName: string): string {
  const base = path.basename(originalName, path.extname(originalName));
  // A name that is nothing but an extension needs a stem invented. Node reads
  // `.heic` as a DOTFILE — `extname` is '' and `basename` is the whole `.heic` —
  // so testing the extension is not enough; what disqualifies a stem is being
  // empty or beginning with a dot.
  const stem = base && !base.startsWith('.') ? base : 'photo';
  return `${stem}.jpg`;
}

/**
 * The extension an uploaded file should be STORED under.
 *
 * Everything else keeps whatever it arrived with — this is the one conversion,
 * and a function that rewrote other formats too would be a second place where a
 * PNG could quietly become something else.
 */
export function storedExtension(originalName: string, converted: boolean): string {
  if (converted) return '.jpg';
  const extension = path.extname(originalName).toLowerCase();
  return extension || '.jpg';
}
