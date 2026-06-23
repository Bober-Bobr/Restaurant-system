// Broad image-format support for every photo picker in the app.
// `image/*` covers most browsers, but several OS file dialogs hide formats like
// HEIC/HEIF/AVIF unless the extension is also listed explicitly, so we append them.
export const IMAGE_ACCEPT =
  'image/*,.jpg,.jpeg,.jfif,.pjpeg,.png,.apng,.gif,.webp,.avif,.heic,.heif,.bmp,.tif,.tiff,.svg,.ico';
