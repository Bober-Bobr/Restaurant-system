import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { MUSIC_SHIM } from './templates/RichRenderer';

/**
 * On a phone the invitation's music never started. A browser starts audible
 * media only from an ACTIVATING gesture — click, pointerup, touchend, keydown, a
 * mouse's pointerdown — and every template retried on pointerdown / touchstart /
 * scroll, none of which a finger produces as an activation. The shim holds a
 * refused start and replays it on the next real gesture.
 */
type Listener = (e: { target: unknown }) => void;

function frame(opts: { refuseMuted?: boolean } = {}) {
  const listeners: Record<string, Listener[]> = {};
  let activated = false;
  class Media {
    paused = true;
    muted = false;
    play(): Promise<void> {
      if (!activated && (!this.muted || opts.refuseMuted)) {
        const err = new Error('blocked');
        err.name = 'NotAllowedError';
        return Promise.reject(err);
      }
      this.paused = false;
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  const win: Record<string, unknown> = {
    Promise,
    HTMLMediaElement: Media,
    addEventListener: (ev: string, fn: Listener) => { (listeners[ev] ||= []).push(fn); },
  };
  win.window = win;
  runInNewContext(MUSIC_SHIM, win);
  const fire = async (ev: string, target: unknown = { closest: () => null }) => {
    activated = ['click', 'pointerup', 'touchend', 'keydown', 'mousedown'].includes(ev);
    (listeners[ev] || []).forEach((fn) => fn({ target }));
    activated = false;
    await new Promise((r) => setTimeout(r, 0));
  };
  return { Media, fire, listeners };
}

describe('a refused start is replayed on the first real gesture', () => {
  it('the template\'s play() resolves once a phone tap arrives — it never sees a rejection', async () => {
    const { Media, fire } = frame();
    const audio = new Media();
    let state = 'pending';
    audio.play().then(() => { state = 'playing'; }, () => { state = 'rejected'; });
    await new Promise((r) => setTimeout(r, 0));
    expect(state).toBe('pending');
    expect(audio.paused).toBe(true);

    // A swipe on a phone: no activation, nothing changes.
    await fire('touchstart');
    expect(audio.paused).toBe(true);

    await fire('touchend');
    expect(audio.paused).toBe(false);
    expect(state).toBe('playing');
  });

  it('leaves a press on the music button to the template, so that click cannot toggle it back off', async () => {
    const { Media, fire } = frame();
    const audio = new Media();
    void audio.play();
    await new Promise((r) => setTimeout(r, 0));
    await fire('click', { closest: (sel: string) => (sel.includes('#music-btn') ? {} : null) });
    expect(audio.paused).toBe(true);
  });

  it('a deliberate pause cancels the waiting start', async () => {
    const { Media, fire } = frame();
    const audio = new Media();
    void audio.play();
    await new Promise((r) => setTimeout(r, 0));
    audio.pause();
    await fire('click');
    expect(audio.paused).toBe(true);
  });

  it('a refused MUTED film is reported, so the template shows its own play button', async () => {
    const { Media } = frame({ refuseMuted: true });
    const film = new Media();
    film.muted = true;
    await expect(film.play()).rejects.toMatchObject({ name: 'NotAllowedError' });
  });

  it('listens only on gestures that carry activation', () => {
    const { listeners } = frame();
    expect(Object.keys(listeners).sort()).toEqual(['click', 'keydown', 'mousedown', 'pointerup', 'touchend']);
  });
});

describe('the block designer\'s player also starts on a phone', () => {
  const src = readFileSync(join(__dirname, '..', 'components', 'MusicPlayer.tsx'), 'utf8');
  it('waits on activating gestures and stays armed until the track plays', () => {
    expect(src).toMatch(/GESTURES = \['click', 'pointerup', 'touchend', 'keydown'\]/);
    expect(src).not.toMatch(/addEventListener\('pointerdown'/);
    expect(src).toMatch(/audio\.play\(\)\.then\(disarm/);
  });
});

describe('Zermatt keeps its cover text after the invitation is opened', () => {
  const html = readFileSync(join(__dirname, 'templates', 'wedding-zermatt', 'template.html'), 'utf8');
  it('no rule fades the title once opened', () => {
    expect(html).not.toMatch(/\.ouv\.is-opened \.ouv__title/);
  });
  it('the type sits on its own layer above the film, for iPhone WebKit', () => {
    // Telegram's in-app browser on iPhone is WebKit; a playing video layer was
    // repainted over the cover's text after scrolling back up.
    expect(html).toMatch(/\.ouv__v,\.ouv__poster\{z-index:0\}/);
    expect(html).toMatch(/\.ouv__in\{z-index:2;[^}]*transform:translateZ\(0\)/);
  });
  it('the cover button still scrolls down after the first press', () => {
    const fn = html.slice(html.indexOf('function openInvitation('), html.indexOf('var onWheel'));
    expect(fn).toMatch(/if \(opened\) \{[\s\S]*scrollIntoView[\s\S]*return;\s*\}/);
  });
});
