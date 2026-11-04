import { useEffect, useRef, useState } from 'react';

// ── Background music player ──────────────────────────────────────────────────
// Loops the given track and tries to autoplay; browsers block autoplay until a
// user gesture, so it also starts on the first pointer/key interaction. A fixed
// accent-colored button in the corner lets the visitor toggle playback.
// `bottomOffset` lets a page lift the button clear of its own fixed furniture —
// the food-service site raises it above the floating cart bar. Defaults to the
// original 18px, so every other caller is unchanged.
export function MusicPlayer({ src, accent, bottomOffset = 18 }: { src: string; accent: string; bottomOffset?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);
  // The visitor's own decision, and it outranks every automatic start below.
  // A ref rather than state: the listeners below are bound once and would
  // otherwise close over a stale value.
  const mutedByUser = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // `playing` follows the ELEMENT, not the call. A play() that is refused, a
    // track that stalls, or a pause from anywhere else used to leave the button
    // showing the opposite of what the page was doing.
    const sync = () => setPlaying(!audio.paused);
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);

    const start = () => {
      if (mutedByUser.current) return;
      audio.play().catch(() => { /* blocked until a gesture */ });
    };

    // Try immediately; most browsers refuse until the visitor interacts.
    start();

    // Only these events carry the user activation a browser demands before
    // audible playback. A finger's `pointerdown`/`touchstart` do NOT (only a
    // mouse's pointerdown does), so listening on pointerdown alone started the
    // music on a desktop and never on a phone. The listeners also stay armed
    // until the track is actually PLAYING: they used to come off after the
    // first try, so one refused attempt left nothing to try again.
    const GESTURES = ['click', 'pointerup', 'touchend', 'keydown'] as const;
    const disarm = () => GESTURES.forEach((ev) => window.removeEventListener(ev, onFirstGesture));
    const onFirstGesture = (event: Event) => {
      // NOT when the gesture is the toggle button itself: this handler would
      // start the track and the button's own click would pause it again —
      // which is precisely why pressing the button appeared to do nothing.
      if (buttonRef.current?.contains(event.target as Node)) return;
      if (mutedByUser.current || !audio.paused) { disarm(); return; }
      audio.play().then(disarm, () => { /* still blocked; keep listening */ });
    };
    GESTURES.forEach((ev) => window.addEventListener(ev, onFirstGesture));
    audio.addEventListener('play', disarm);

    return () => {
      audio.removeEventListener('play', sync);
      audio.removeEventListener('pause', sync);
      audio.removeEventListener('play', disarm);
      disarm();
      audio.pause();
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      mutedByUser.current = false;
      audio.play().catch(() => setPlaying(false));
    } else {
      mutedByUser.current = true;
      audio.pause();
    }
  };

  return (
    <>
      <audio ref={audioRef} src={src} loop preload="auto" />
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause music' : 'Play music'}
        style={{
          position: 'fixed', bottom: bottomOffset, right: 18, zIndex: 60,
          width: 50, height: 50, borderRadius: '50%',
          background: accent, color: '#1a1a1a', border: '2px solid rgba(255,255,255,0.85)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          transition: 'bottom .28s cubic-bezier(.22, 1, .36, 1)',
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
