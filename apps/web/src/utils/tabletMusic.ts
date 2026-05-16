// Module-level singleton so the audio object survives route changes.
// Once start() succeeds in a user-gesture handler, the audio keeps playing
// across navigation because we never recreate or unmount the element.

let audio: HTMLAudioElement | null = null;
let started = false;
let welcomeShown = false;
let lastTrackIdx = -1;

const TRACKS = ['/tablet-track-1.mp3', '/tablet-track-2.mp3', '/tablet-track-3.mp3'];

function pickNextTrack(): number {
  if (TRACKS.length <= 1) return 0;
  let idx = lastTrackIdx;
  while (idx === lastTrackIdx) {
    idx = Math.floor(Math.random() * TRACKS.length);
  }
  return idx;
}

function playRandom() {
  if (!audio) return;
  const idx = pickNextTrack();
  lastTrackIdx = idx;
  audio.src = TRACKS[idx];
  audio.play()
    .then(() => { started = true; })
    .catch(() => {});
}

export function startTabletMusic() {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener('ended', playRandom);
  }
  playRandom();
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
