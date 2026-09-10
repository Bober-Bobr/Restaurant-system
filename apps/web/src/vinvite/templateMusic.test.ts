import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * If a template shows a music button, pressing it must do something.
 *
 * Four templates — chateau, paris, samarkand, stillvatn — rendered the button,
 * styled it, toggled its `aria-pressed`, and **bound no handler to it at all**.
 * Pressing it did nothing, and since the only call to `startMusic()` was inside
 * the RSVP modal's open(), a guest who never opened the reply form heard no
 * music either. That is the whole of "the music does not play, and the button
 * does not start it".
 *
 * Autoplay itself cannot be guaranteed and this file does not pretend otherwise:
 * every current browser refuses to start audible media without a user gesture.
 * What CAN be guaranteed, and is what these assert, is that the attempt is made
 * on load, that a refusal arms a retry on the guest's first gesture, and that a
 * deliberate pause is never overridden by that retry.
 */
const DIR = join(__dirname, 'templates');
const TEMPLATES = readdirSync(DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(DIR, e.name, 'template.html')))
  .map((e) => e.name);

const read = (name: string) => readFileSync(join(DIR, name, 'template.html'), 'utf8');
/** The templates explain this machinery at length; prose must not satisfy a check. */
const code = (src: string) => {
  const js = /<script>([\s\S]*)<\/script>/.exec(src)?.[1] ?? src;
  return js.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
};

/**
 * The source with ONE named function's body removed, brace-matched.
 *
 * Used to ask "is this called anywhere but there?". A plain string search cannot
 * answer that — the call inside the function being excluded matches too, which
 * is precisely the arrangement this file exists to reject.
 */
function withoutFunctionBody(js: string, fnName: string): string {
  const at = js.indexOf(`function ${fnName}`);
  if (at === -1) return js;
  const open = js.indexOf('{', at);
  if (open === -1) return js;
  let depth = 0;
  for (let i = open; i < js.length; i += 1) {
    if (js[i] === '{') depth += 1;
    else if (js[i] === '}') { depth -= 1; if (depth === 0) return js.slice(0, at) + js.slice(i + 1); }
  }
  return js.slice(0, at);
}

/**
 * Every NAMED function body removed, leaving what runs at load.
 *
 * Named only: the whole template script is wrapped in an anonymous IIFE, and
 * matching `function (` strips the entire file — which made an earlier version
 * of this check pass against everything, including the bug.
 */
function withoutNamedFunctionBodies(js: string): string {
  let out = '';
  for (let i = 0; i < js.length; i += 1) {
    const m = /^function\s+[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{/.exec(js.slice(i, i + 200));
    if (!m) { out += js[i]; continue; }
    let depth = 0;
    let j = i + m[0].length - 1;
    for (; j < js.length; j += 1) {
      if (js[j] === '{') depth += 1;
      else if (js[j] === '}') { depth -= 1; if (depth === 0) break; }
    }
    i = j;
  }
  return out;
}

describe.each(TEMPLATES)('%s', (name) => {
  const src = read(name);
  const js = code(src);
  const hasButton = src.includes('id="music-btn"');

  it('binds a click handler to the music button', () => {
    if (!hasButton) return;
    expect(
      /musicBtn\.addEventListener\(\s*['"]click['"]/.test(js)
      || /\$\(\s*['"]#music-btn['"]\s*\)\.addEventListener\(\s*['"]click['"]/.test(js),
      'the button is rendered but nothing listens to it — pressing it does nothing',
    ).toBe(true);
  });

  it('starts the track from somewhere other than the reply form', () => {
    if (!hasButton) return;
    // The bug: the ONLY call to startMusic() sat inside the RSVP modal's open(),
    // so a guest who never opened the reply form heard nothing at all.
    //
    // Where that call lives is otherwise the template's own business. Several
    // start it from the envelope/cover tap rather than at load, which is not a
    // lesser design — that tap IS the gesture autoplay needs, so play() actually
    // succeeds instead of being refused. What is not allowed is the reply form
    // being the only way.
    // Deliberately does NOT accept a bare `audio.play()` as evidence: the one in
    // the button's own click handler would satisfy it, and the button working is
    // a separate guarantee (above). What is wanted here is an AUTOMATIC start.
    const outside = withoutFunctionBody(js, 'initRsvp');
    expect(
      // The lookbehind matters: without it `function startMusic()` — the
      // DEFINITION — satisfies the search, and the check passes against a
      // template where nothing calls it.
      /(?<!function\s)\b(initMusic|startMusic)\s*\(\s*\)/.test(outside),
      'the reply form is the only thing that starts the music',
    ).toBe(true);
  });

  it('and where it defines initMusic(), the boot actually calls it', () => {
    if (!hasButton || !/function initMusic/.test(js)) return;
    // The check above cannot see reachability: with the boot call deleted, the
    // `startMusic()` sitting inside initMusic's own body still satisfies it.
    // This is the precise version — every NAMED function body removed, so what
    // is left is what actually runs.
    const topLevel = withoutNamedFunctionBodies(js);
    expect(
      /\binitMusic\s*\(\s*\)/.test(topLevel),
      'initMusic() is defined but never called — the button works, nothing autoplays',
    ).toBe(true);
  });

  it('retries on the first gesture when autoplay is refused', () => {
    if (!hasButton) return;
    expect(/RETRY_EVENTS|addEventListener\(\s*ev\s*,\s*retry/.test(js)).toBe(true);
  });
});

describe('a deliberate pause outranks every automatic start', () => {
  // The retry listens for pointerdown / touchstart / keydown / SCROLL. Without a
  // flag, pressing pause and then scrolling restarts the track — a scroll is a
  // gesture, and the listeners are still armed.
  for (const name of TEMPLATES) {
    const js = code(read(name));
    if (!/RETRY_EVENTS/.test(js)) continue;
    it(name, () => {
      const guarded = /musicOff/.test(js);
      if (!guarded) return;                 // older templates predate the flag
      // Where the flag exists it has to be consulted by BOTH automatic paths,
      // or it guards only half of them.
      const start = js.slice(js.indexOf('function startMusic'));
      expect(start.slice(0, 400), 'startMusic ignores the flag').toContain('musicOff');
      const retry = js.slice(js.indexOf('function armMusicRetry'));
      expect(retry.slice(0, 500), 'the gesture retry ignores the flag').toContain('musicOff');
    });
  }
});

describe('the shared block-designer player has the same guarantees', () => {
  // Different implementation, same two failure modes. Its bug was subtler: the
  // first-gesture listener fired on `pointerdown` anywhere INCLUDING the toggle
  // button, so the press started the track and the `click` that followed paused
  // it again — the button looked dead for exactly the same reason.
  const src = readFileSync(join(__dirname, '..', 'components', 'MusicPlayer.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

  it('the first-gesture listener ignores the button itself', () => {
    expect(src).toContain('buttonRef.current?.contains(event.target as Node)');
    expect(src).toMatch(/ref=\{buttonRef\}/);
  });

  it('a deliberate pause is remembered', () => {
    expect(src).toContain('mutedByUser');
    const start = src.slice(src.indexOf('const start ='));
    expect(start.slice(0, 200), 'autoplay ignores the visitor having muted it').toContain('mutedByUser.current');
  });

  it('the button reflects the audio element, not the last call', () => {
    // A refused play() used to leave the button showing "playing".
    expect(src).toContain("audio.addEventListener('play', sync)");
    expect(src).toContain("audio.addEventListener('pause', sync)");
  });
});
