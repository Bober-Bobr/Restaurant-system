/**
 * The noise a waiter's phone makes when a table calls.
 *
 * **Synthesised, not a file.** Two short tones through WebAudio: an asset would
 * be a request this page does not otherwise make, cached by a service worker
 * that would then have to be versioned with it, and a sound file that fails to
 * load is a silent alert nobody notices is missing.
 *
 * **Nothing here may throw.** An alert is a courtesy on top of the banner,
 * which is the thing that actually carries the message — so a browser with no
 * AudioContext, a tab that has never been touched (autoplay policy), or a
 * device with the volume down all end up silent rather than breaking the render
 * that was announcing the call.
 */

let ctx: AudioContext | null = null;

type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** One tone. */
function tone(at: number, frequency: number, seconds: number) {
  const audio = context();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  // An envelope rather than a bare on/off: a square edge on a phone speaker
  // clicks, and the click is louder than the tone.
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

/**
 * Sound the alert, and buzz the phone.
 *
 * Two rising tones, which is what a room full of people and cutlery leaves
 * audible — one short beep is lost. The vibration is the part that works with
 * the volume down, and is the reason this is one function rather than two: a
 * call must not be announceable without it.
 */
export function playCallAlert(): void {
  try {
    const audio = context();
    if (audio) {
      // A context created before the first touch starts suspended. Resuming is
      // a promise that may reject; nothing waits on it.
      if (audio.state === 'suspended') void audio.resume().catch(() => undefined);
      const now = audio.currentTime;
      tone(now, 880, 0.16);
      tone(now + 0.2, 1175, 0.2);
    }
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    // Silence is acceptable; a thrown error during a render is not.
  }
}
