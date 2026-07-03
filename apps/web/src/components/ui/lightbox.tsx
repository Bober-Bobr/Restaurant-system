import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export const Lightbox = ({ src, alt = '', onClose }: LightboxProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    // The overlay scrolls so an image larger than the viewport can be viewed at
    // its own (native) resolution instead of being shrunk to the device screen.
    <div
      className="fixed inset-0 z-[9999] overflow-auto bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* min-w/min-h-full keeps a smaller-than-viewport image centered, while a
          larger one overflows into the scroll container at full resolution. */}
      <div className="flex min-h-full min-w-full items-center justify-center p-4">
        <img
          src={src}
          alt={alt}
          onClick={(e) => e.stopPropagation()}
          className="rounded-2xl shadow-2xl"
          style={{ maxWidth: 'none', maxHeight: 'none', width: 'auto', height: 'auto' }}
        />
      </div>
    </div>,
    document.body
  );
};
