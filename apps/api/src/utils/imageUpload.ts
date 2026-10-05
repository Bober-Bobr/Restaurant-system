import path from 'path';
import createHttpError from 'http-errors';
import { prepareImage } from './heicConvert.js';
import { storedExtension } from './heic.js';

// Image formats accepted across every photo upload + listing in the app.
export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.jfif', '.pjpeg', '.png', '.apng', '.gif', '.webp',
  '.avif', '.heic', '.heif', '.hif', '.bmp', '.tif', '.tiff', '.svg', '.ico',
];

// Accept by MIME type (covers most uploads) OR by extension, since some formats
// (HEIC/HEIF, AVIF, etc.) arrive as application/octet-stream from certain devices.
export function isAllowedImage(file: { mimetype: string; originalname: string }): boolean {
  if (file.mimetype.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());
}

export type UploadedImage = { buffer: Buffer; extension: string };

/**
 * What an uploaded photo should be WRITTEN as.
 *
 * Every upload path in the product goes through this — the photo service, the
 * public review and invitation-request forms, and performer media — because
 * each of them used to do the same two lines by hand (`extname(originalname)`,
 * `writeFile(file.buffer)`) and a HEIC fix applied to three of the four leaves
 * a fourth place where an iPhone photo still lands undisplayable.
 *
 * HEIC is re-encoded to JPEG and takes a `.jpg` name; everything else is stored
 * exactly as it arrived.
 *
 * **A HEIC that cannot be decoded is REFUSED, not stored.** Writing it anyway
 * would put a file on disk and a URL in the database that no browser but Safari
 * will draw — which is precisely the bug being fixed, so falling back to it
 * would mean failing silently in the same way, only now on purpose.
 */
export async function prepareUpload(
  file: { buffer: Buffer; originalname: string },
): Promise<UploadedImage> {
  try {
    const { buffer, converted } = await prepareImage(file.buffer);
    return { buffer, extension: storedExtension(file.originalname, converted) };
  } catch {
    throw createHttpError(
      415,
      'This HEIC photo could not be read. Please try again, or save it as JPEG on your phone first.',
    );
  }
}
