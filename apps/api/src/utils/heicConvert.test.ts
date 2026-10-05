import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { heicToJpeg, prepareImage } from './heicConvert.js';
import { isHeicBuffer } from './heic.js';

// ── The conversion itself ───────────────────────────────────────────────────
// The detection rules are unit-tested in `heic.test.ts`; this covers the worker
// and the decoder.
//
// **No HEIC fixture is committed.** `libheif-js` ships a decoder and no encoder,
// so one cannot be generated here, and a real one is a 2–3 MB photograph off
// somebody's phone — not something to put in a repository. What that leaves is
// covered three ways: the pass-through paths and the failure path run always
// (an undecodable HEIC needs only a real header, which IS constructible); the
// worker arrangement is asserted from the source, because it is a structural
// promise about where the CPU time goes rather than something a return value
// shows; and the full round trip runs against a real photo when one is pointed
// at by HEIC_FIXTURE.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** A genuine `ftyp heic` header with nothing decodable behind it. */
function undecodableHeic(): Buffer {
  const head = Buffer.alloc(24);
  head.writeUInt32BE(24, 0);
  head.write('ftyp', 4, 'latin1');
  head.write('heic', 8, 'latin1');
  head.writeUInt32BE(0, 12);
  head.write('mif1', 16, 'latin1');
  head.write('heic', 20, 'latin1');
  return Buffer.concat([head, Buffer.from('not actually an image', 'latin1')]);
}

describe('what prepareImage leaves alone', () => {
  // This must stay a conversion of ONE format. Re-encoding every upload would
  // quietly degrade the JPEGs and PNGs that have always worked, which is a far
  // bigger change than the one that was asked for.

  it('passes a JPEG through byte-for-byte', async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 2, 3]);
    const result = await prepareImage(jpeg);
    expect(result.converted).toBe(false);
    // The same buffer, not a copy of it: nothing re-encoded it on the way past.
    expect(result.buffer).toBe(jpeg);
  });

  it('passes a PNG through byte-for-byte', async () => {
    const png = Buffer.from('\x89PNG\r\n\x1a\nIHDR-not-really-but-enough', 'latin1');
    const result = await prepareImage(png);
    expect(result.converted).toBe(false);
    expect(result.buffer).toBe(png);
  });

  it('passes an AVIF through, though it is the same container', async () => {
    const avif = Buffer.alloc(24);
    avif.writeUInt32BE(24, 0);
    avif.write('ftyp', 4, 'latin1');
    avif.write('avif', 8, 'latin1');
    avif.write('mif1', 16, 'latin1');
    avif.write('avif', 20, 'latin1');
    const result = await prepareImage(avif);
    expect(result.converted).toBe(false);
  });
});

describe('when a HEIC cannot be decoded', () => {
  it('REJECTS rather than hanging', async () => {
    // The header is real, so detection hands it to the decoder, which cannot
    // finish. The promise has to settle: a request that hangs for ever holds a
    // multer buffer and a worker thread, and is worse than one that fails.
    await expect(heicToJpeg(undecodableHeic())).rejects.toThrow();
  }, 60_000);

  it('settles every time, not just the first', async () => {
    // Each call gets its own worker, and a listener left on a terminated one
    // would make the second call hang where the first did not.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(heicToJpeg(undecodableHeic())).rejects.toThrow();
    }
  }, 60_000);

  it('surfaces as a 415 from prepareUpload rather than storing the file', async () => {
    // Storing it anyway would put a URL in the database that no browser but
    // Safari can draw — which is the bug being fixed, only now on purpose.
    const { prepareUpload } = await import('./imageUpload.js');
    await expect(prepareUpload({ buffer: undecodableHeic(), originalname: 'IMG_1.HEIC' }))
      .rejects.toMatchObject({ status: 415 });
  }, 60_000);
});

describe('the decode happens OFF the main thread', () => {
  // Measured on the main thread, a 12-megapixel photo let ZERO timers through in
  // 1.3 seconds. The API is a single process, so a ten-photo upload would freeze
  // the kiosk, the floor map and every other request for about thirteen seconds.
  // There is no return value that shows this, so the arrangement is read from
  // the source.
  const SOURCE = readFileSync(path.join(__dirname, 'heicConvert.ts'), 'utf8');

  it('runs the conversion in a worker thread', () => {
    expect(SOURCE).toMatch(/new Worker\(WORKER_SOURCE/);
    expect(SOURCE).toMatch(/from 'node:worker_threads'/);
  });

  it('never calls heic-convert on the main thread', () => {
    // A top-level import of it would be the easy way to "simplify" this back
    // into a freeze that only shows up under load.
    expect(SOURCE).not.toMatch(/^import .*heic-convert/m);
    const insideWorker = /const WORKER_SOURCE = `[\s\S]*?`;/.exec(SOURCE)?.[0] ?? '';
    expect(insideWorker).toMatch(/heic-convert/);
  });

  it('bounds the work with a timeout and always terminates the worker', () => {
    // The timer must be ARMED with it — asserting the constant merely exists
    // passes against a `setTimeout` that was deleted and left the declaration
    // behind, which is how a break-check caught this assertion being too weak.
    expect(SOURCE).toMatch(/setTimeout\([\s\S]{0,200}?TIMEOUT_MS,?\s*\)/);
    expect(SOURCE).toMatch(/worker\.terminate\(\)/);
    // Every exit path goes through `settle`, which terminates — including the
    // timeout, where a wedged wasm decode would otherwise keep a thread and its
    // memory for the life of the process.
    expect(SOURCE).toMatch(/const settle = /);
  });

  it('settles if the worker dies without posting anything', () => {
    expect(SOURCE).toMatch(/worker\.once\('exit'/);
  });
});

// ── The real round trip ─────────────────────────────────────────────────────
// Point HEIC_FIXTURE at a photo off a phone to run this:
//   HEIC_FIXTURE=/path/to/IMG_0001.HEIC npm run test:api
const fixture = process.env.HEIC_FIXTURE;
describe.runIf(fixture)('a real photo from a phone', () => {
  it('comes back as a JPEG a browser can draw', async () => {
    const heic = readFileSync(fixture!);
    expect(isHeicBuffer(heic)).toBe(true);

    const result = await prepareImage(heic);
    expect(result.converted).toBe(true);
    // The magic bytes, not the length: a buffer that is merely non-empty would
    // pass while holding anything at all.
    expect(result.buffer.subarray(0, 3).equals(JPEG_MAGIC)).toBe(true);
    expect(isHeicBuffer(result.buffer)).toBe(false);
  }, 120_000);
});
