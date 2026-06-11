import { useEffect, useRef, useState } from 'react';

// ── Background music player ──────────────────────────────────────────────────
// Loops the given track and tries to autoplay; browsers block autoplay until a
// user gesture, so it also starts on the first pointer/key interaction. A fixed
// accent-colored button in the corner lets the visitor toggle playback.
export function MusicPlayer({ src, accent }: { src: string; accent: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const start = () => {
      audio.play().then(() => setPlaying(true)).catch(() => { /* blocked until a gesture */ });
    };

    // Try immediately; most browsers will reject until the user interacts.
    start();

    const onFirstGesture = () => {
      start();
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture);
    window.addEventListener('keydown', onFirstGesture);

    return () => {
      window.removeEventListener('pointerdown', onFirstGesture);
      window.removeEventListener('keydown', onFirstGesture);
      audio.pause();
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause music' : 'Play music'}
        style={{
          position: 'fixed', bottom: 18, right: 18, zIndex: 60,
          width: 50, height: 50, borderRadius: '50%',
          background: accent, color: '#1a1a1a', border: '2px solid rgba(255,255,255,0.85)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        }}
      >
        {playing ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        )}
      </button>
    </>
  );
}
