import { Worker } from 'node:worker_threads';
import { isHeicBuffer } from './heic.js';

/**
 * HEIC → JPEG, on a worker thread.
 *
 * ── WHY A WORKER, AND NOT JUST `await convert(...)` ────────────────────────
 * `heic-convert` decodes through libheif compiled to WebAssembly, and that work
 * is CPU-bound and synchronous however many `await`s are wrapped around it.
 * Measured on a 12-megapixel iPhone photo: **1.3 s during which the event loop
 * fired ZERO timers**. The API is a single process (the rate limiter's own note
 * says so), so a ten-photo upload would freeze every other request in the
 * restaurant — the kiosk, the floor map, a waiter closing an order — for about
 * thirteen seconds. On a worker the same conversion let 150 of an expected 153
 * timer ticks through.
 *
 * ── WHY THE WORKER IS A STRING, AND NOT A FILE ─────────────────────────────
 * A worker is started from a RUNTIME path, not an import, so a `./heicWorker.js`
 * beside this file would have to exist as `.ts` under `tsx` in development and
 * as `.js` under `dist/` in production — and nothing in the build copies or
 * rewrites it. `eval: true` sidesteps the question: there is no second file to
 * resolve, and the worker loads `heic-convert` itself with a dynamic import,
 * which works identically in both.
 */

/**
 * JPEG quality.
 *
 * Measured against a real 2.74 MB iPhone HEIC: 0.9 → 3.80 MB, **0.82 → 2.79 MB**,
 * 0.75 → 2.32 MB. 0.82 lands within a couple of per cent of the file the person
 * actually chose, so converting changes what they uploaded as little as possible
 * in either direction — a photo that arrives and silently becomes 40% heavier is
 * its own bug, and one that visibly softens is worse.
 */
const QUALITY = 0.82;

/**
 * A conversion that has not finished in this long is abandoned.
 *
 * A worker that hangs would otherwise hold the request, and with it a multer
 * buffer of up to 60 MB, for as long as the client waits. 1.3 s is typical for
 * 12 megapixels, so 60 s is roughly forty times the expected cost — long enough
 * that a slow server never trips it, short enough to be a bound.
 */
const TIMEOUT_MS = 60_000;

// The whole worker. `postMessage` TRANSFERS the result's memory rather than
// copying it, so a 3 MB photo does not exist twice at the moment of handover.
const WORKER_SOURCE = `
  import { parentPort, workerData } from 'node:worker_threads';
  const convert = (await import('heic-convert')).default;
  const out = await convert({
    buffer: Buffer.from(workerData.buffer),
    format: 'JPEG',
    quality: workerData.quality,
  });
  const copy = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  parentPort.postMessage(copy, [copy]);
`;

export class HeicConversionError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'HeicConversionError';
  }
}

/** Decode a HEIC buffer to JPEG. Rejects with `HeicConversionError` if it cannot. */
export function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: { buffer, quality: QUALITY },
        // libheif prints its own diagnostics on any unreadable input ("Could
        // not parse HEIF file …") — on STDOUT, measured, not stderr as the name
        // of the message suggests, so both are detached. Left piped, one guest
        // uploading a damaged photo writes wasm noise into the server's logs
        // for a failure the caller is already told about through the rejected
        // promise.
        stdout: true,
        stderr: true,
      });
    } catch (error) {
      reject(new HeicConversionError(error));
      return;
    }

    // `settle` runs exactly once and always terminates the worker — including on
    // the timeout path, where otherwise a wedged wasm decode would keep a thread
    // and its memory for the life of the process.
    let done = false;
    const settle = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      void worker.terminate();
      fn();
    };

    const timer = setTimeout(
      () => settle(() => reject(new HeicConversionError(new Error('HEIC conversion timed out')))),
      TIMEOUT_MS,
    );

    worker.once('message', (jpeg: ArrayBuffer) => settle(() => resolve(Buffer.from(jpeg))));
    worker.once('error', (error) => settle(() => reject(new HeicConversionError(error))));
    worker.once('exit', (code) => {
      // Only meaningful if it beat the message: a worker that exits non-zero
      // without posting anything has failed silently, and without this the
      // promise would never settle and the request would hang.
      if (code !== 0) settle(() => reject(new HeicConversionError(new Error(`HEIC worker exited with ${code}`))));
    });
  });
}

export type PreparedImage = {
  buffer: Buffer;
  /** True when the bytes were re-encoded, so the caller stores `.jpg`. */
  converted: boolean;
};

/**
 * The one call every upload path makes.
 *
 * Anything that is not HEIC is returned untouched — this must stay a conversion
 * of ONE format. Re-encoding every upload would quietly degrade the JPEGs and
 * PNGs that have always worked, which is a far bigger change than the one asked
 * for.
 */
export async function prepareImage(buffer: Buffer): Promise<PreparedImage> {
  if (!isHeicBuffer(buffer)) return { buffer, converted: false };
  return { buffer: await heicToJpeg(buffer), converted: true };
}
