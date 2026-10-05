import { promises as fs } from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import { hasHeicExtension } from '../utils/heic.js';
import { heicToJpeg } from '../utils/heicConvert.js';

/**
 * Serves the HEIC photos that were uploaded BEFORE the conversion existed.
 *
 * New uploads are converted on the way in (`prepareUpload`), so nothing written
 * from now on reaches this. What it is for is the photos already on disk: they
 * uploaded fine, their URLs went into the database, and they have been drawing
 * as broken images ever since.
 *
 * ── WHY SERVE-TIME, AND NOT A SCRIPT THAT REWRITES THE DATABASE ────────────
 * A stored photo URL is not in one column. It is in `MenuItem.photoUrl`,
 * `Restaurant.logoUrl`, `Company.logoUrl`, `Review.photoUrl`, the `photos` JSON
 * arrays on `Hall` and `TableCategory`, the performer profile's JSON, and —
 * worst — inside the `blocks` JSON of every flyer, invitation and NFC plaque,
 * at a different depth per block type. A migration would have to find and
 * rewrite all of them, and the one it missed would stay broken with no sign.
 *
 * Converting at serve time fixes every one of those at once and rewrites
 * nothing: the URL keeps working, the bytes that come back are JPEG, and the
 * browser draws by `Content-Type` rather than by the name in the URL.
 *
 * In production nginx proxies `/uploads` to this process (see CLAUDE.md,
 * Deployment), so this runs there too rather than being bypassed by the static
 * server.
 */

/** Converted copies live here, NOT beside the original — see `cachePathFor`. */
const CACHE_DIR = '.jpeg-cache';

/**
 * In-flight conversions, so two requests for the same cold photo decode once.
 *
 * A page full of a restaurant's menu asks for its images all at once, and
 * without this a dozen 1.3-second decodes would start in parallel — a dozen
 * worker threads, each holding a decoded 12-megapixel frame.
 */
const inFlight = new Map<string, Promise<Buffer>>();

/**
 * Where the converted copy of `absolute` is kept.
 *
 * In a `.jpeg-cache` subdirectory rather than as a `photo.jpg` beside
 * `photo.heic`, because `PhotoService.listPhotos` reads these directories to
 * build the photo picker and filters by extension — a sibling JPEG would show
 * up there as a SECOND copy of the same photograph, and deleting one of the two
 * would leave the other orphaned. The dot-prefix keeps it out of that listing
 * for the same reason.
 */
function cachePathFor(absolute: string): string {
  return path.join(path.dirname(absolute), CACHE_DIR, `${path.basename(absolute)}.jpg`);
}

async function readIfPresent(file: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

export function heicUploads(uploadsDir: string) {
  const root = path.resolve(uploadsDir);

  return async function serveHeicAsJpeg(request: Request, response: Response, next: NextFunction): Promise<void> {
    if (request.method !== 'GET' && request.method !== 'HEAD') { next(); return; }

    let relative: string;
    try {
      // `request.path` is still percent-encoded, and a filename may legitimately
      // contain a space. A malformed escape throws, and that is a request we
      // simply do not handle rather than a 500.
      relative = decodeURIComponent(request.path);
    } catch { next(); return; }

    if (!hasHeicExtension(relative)) { next(); return; }

    // Path traversal: resolve, then prove the result is still inside the uploads
    // directory. `express.static` guards itself, but this middleware opens files
    // by its own path and has to make the same check for itself.
    const absolute = path.resolve(root, `.${path.posix.normalize(relative)}`);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) { next(); return; }

    try {
      const cached = await readIfPresent(cachePathFor(absolute));
      if (cached) { sendJpeg(response, cached); return; }

      const source = await readIfPresent(absolute);
      // Not there at all: let the static server answer, so a missing photo is
      // the 404 it has always been rather than a different error from here.
      if (!source) { next(); return; }

      let pending = inFlight.get(absolute);
      if (!pending) {
        pending = heicToJpeg(source).finally(() => inFlight.delete(absolute));
        inFlight.set(absolute, pending);
      }
      const jpeg = await pending;

      // Written after the response is decided, and a cache that cannot be
      // written is not an error — the photo is already converted in memory, and
      // a read-only uploads directory should cost speed, not the picture.
      void writeCache(absolute, jpeg);
      sendJpeg(response, jpeg);
    } catch {
      // Undecodable, or the worker failed. Fall through to the static server:
      // the original still reaches Safari, and this file was already broken
      // everywhere else — turning that into a 500 would make it worse.
      next();
    }
  };
}

function sendJpeg(response: Response, jpeg: Buffer): void {
  response.setHeader('Content-Type', 'image/jpeg');
  // The source file is immutable — upload names carry a timestamp and a random
  // suffix and are never rewritten — so this may be cached as hard as the
  // static server caches everything else beside it.
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  response.send(jpeg);
}

async function writeCache(absolute: string, jpeg: Buffer): Promise<void> {
  try {
    const target = cachePathFor(absolute);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, jpeg);
  } catch {
    /* A cache that cannot be written costs a re-decode, nothing more. */
  }
}
