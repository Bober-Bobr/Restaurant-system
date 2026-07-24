import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  // Dish photos open much smaller so they don't dominate the tablet screen.
  compact?: boolean;
}

export const Lightbox = ({ src, alt = '', onClose, compact = false }: LightboxProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Opened full-screen: the image expands to fill the viewport (up to its own
          native size). object-contain preserves the aspect ratio and never upscales
          past the image's own resolution, so nothing looks stretched or blurry.
          `compact` still trims the height a touch so dish photos don't run edge to
          edge, but no longer caps the width at a small fixed size. */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl object-contain shadow-2xl"
        style={
          compact
            ? { maxWidth: '94vw', maxHeight: '86vh', width: 'auto', height: 'auto' }
            : { maxWidth: '94vw', maxHeight: '92vh', width: 'auto', height: 'auto' }
        }
      />
    </div>,
    document.body
  );
};
