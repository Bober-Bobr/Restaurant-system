// Broad image-format support for every photo picker in the app.
// `image/*` covers most browsers, but several OS file dialogs hide formats like
// HEIC/HEIF/AVIF unless the extension is also listed explicitly, so we append them.
//
// EVERY picker uses this one string. Four of them carried a bare `image/*`,
// which is the case this constant exists to fix — and those four are also the
// ones a guest reaches from a phone (a performer's own avatar and gallery, a
// restaurant's extra-service photos, and the Additional Services form). The
// extensions must stay in step with `IMAGE_EXTENSIONS` on the API, which is
// what actually decides whether an upload is accepted; `uploadFormats.test.ts`
// imports both and fails if they drift.
export const IMAGE_ACCEPT =
  'image/*,.jpg,.jpeg,.jfif,.pjpeg,.png,.apng,.gif,.webp,.avif,.heic,.heif,.hif,.bmp,.tif,.tiff,.svg,.ico';
