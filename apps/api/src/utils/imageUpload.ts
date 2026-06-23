import path from 'path';

// Image formats accepted across every photo upload + listing in the app.
export const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.jfif', '.pjpeg', '.png', '.apng', '.gif', '.webp',
  '.avif', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.svg', '.ico',
];

// Accept by MIME type (covers most uploads) OR by extension, since some formats
// (HEIC/HEIF, AVIF, etc.) arrive as application/octet-stream from certain devices.
export function isAllowedImage(file: { mimetype: string; originalname: string }): boolean {
  if (file.mimetype.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase());
}
