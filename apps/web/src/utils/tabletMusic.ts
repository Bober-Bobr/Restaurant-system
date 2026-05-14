// Module-level singleton so the audio object survives route changes.
// Once start() succeeds in a user-gesture handler, the audio keeps playing
// across navigation because we never recreate or unmount the element.

let audio: HTMLAudioElement | null = null;
let started = false;
let welcomeShown = false;

const SRC = '/tablet-music.mp3';

export function startTabletMusic() {
  if (!audio) {
    audio = new Audio(SRC);
    audio.loop = true;
  }
  audio.play()
    .then(() => { started = true; })
    .catch(() => {});
}

export function stopTabletMusic() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  started = false;
  welcomeShown = false;
}

export function isTabletMusicStarted() {
  return started && !!audio && !audio.paused;
}

export function markTabletWelcomeShown() {
  welcomeShown = true;
}

export function isTabletWelcomeShown() {
  return welcomeShown;
}
