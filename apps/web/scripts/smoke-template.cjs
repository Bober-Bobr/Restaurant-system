/**
 * Runtime smoke test for the rich (iframe-hosted) invitation templates.
 *
 * `node --check` only validates syntax, so a top-level TypeError in a template's
 * inline script — which blanks the whole invitation — passes every other check
 * we run. This parses the real template HTML into a DOM, injects the template's
 * own defaultConfig the way RichRenderer does, executes the inline script, and
 * then drives the interactions that only happen later (envelope click, scroll,
 * resize, deferred animation steps).
 *
 *   node scripts/smoke-template.cjs                 # every rich template
 *   node scripts/smoke-template.cjs birthday-tuscan # just one
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { parseHTML } = require('linkedom');

const TEMPLATES_DIR = path.join(__dirname, '..', 'src', 'vinvite', 'templates');

/** Pull `defaultConfig` out of a definition.ts without a bundler. */
function readDefaultConfig(definitionPath) {
  const src = fs.readFileSync(definitionPath, 'utf8');
  const start = src.indexOf('const defaultConfig = {');
  if (start === -1) return {};
  const end = src.indexOf('export const', start);
  const ts = src.slice(start, end === -1 ? undefined : end) + '\ndefaultConfig;';
  const js = require('esbuild').transformSync(ts, { loader: 'ts' }).code;
  return vm.runInNewContext(js);
}

function smoke(name) {
  const dir = path.join(TEMPLATES_DIR, name);
  const htmlPath = path.join(dir, 'template.html');
  const config = readDefaultConfig(path.join(dir, 'definition.ts'));

  const bootstrap =
    `<script>window.__CONFIG__=${JSON.stringify(config)};` +
    `window.__LANGS__=["ru","uz","en"];window.__ORIGIN__="https://v-invite.uz";</script>`;
  const html = fs.readFileSync(htmlPath, 'utf8').replace('<!--__CONFIG__-->', bootstrap);

  const { window, document } = parseHTML(html);
  const errors = [];
  const trap = (fn) => { try { fn(); } catch (e) { errors.push(e); } };

  window.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
  // Deferred, like a real browser. Running rAF callbacks synchronously inverts
  // the order of "schedule then set flag" guards and can hide their bugs.
  let frame = [];
  window.requestAnimationFrame = (cb) => frame.push(cb);
  window.cancelAnimationFrame = () => {};
  const flushFrames = () => {
    for (let i = 0; i < 8 && frame.length; i++) {   // bounded: self-requeueing loops
      const q = frame; frame = [];
      for (const cb of q) trap(() => cb(0));
    }
  };
  window.getComputedStyle = () => ({ transform: 'none', getPropertyValue: () => '' });
  window.scrollTo = () => {};
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.innerHeight = 800; window.innerWidth = 400; window.scrollY = 0;
  window.console = console;
  // Deferred work runs synchronously (capped) so staged animations are covered.
  let budget = 400;
  const run = (fn) => { if (typeof fn === 'function' && budget-- > 0) trap(fn); return 0; };
  window.setTimeout = run; window.setInterval = run;
  window.clearTimeout = () => {}; window.clearInterval = () => {};
  // linkedom has no layout engine; the FLIP unfold needs a plausible box.
  if (window.Element && !window.Element.prototype.getBoundingClientRect) {
    window.Element.prototype.getBoundingClientRect = () => ({
      x: 40, y: 200, left: 40, top: 200, right: 360, bottom: 440, width: 320, height: 240,
    });
  }

  // Capture bridge messages the way RichRenderer would receive them.
  const posted = [];
  window.parent = { postMessage: (msg) => posted.push(msg) };

  const ctx = vm.createContext(window);
  for (const s of document.querySelectorAll('script')) {
    if (!s.textContent.trim()) continue;
    trap(() => vm.runInContext(s.textContent, ctx, { filename: `${name}/template.html` }));
  }

  flushFrames();
  const el = document.querySelector('#envelopeWrap');
  if (el) trap(() => el.dispatchEvent(new window.Event('click')));
  flushFrames();
  for (const type of ['scroll', 'resize']) {
    trap(() => window.dispatchEvent(new window.Event(type)));
    flushFrames();
  }

  // Drive the RSVP form: fill the name and submit, then require the bridge
  // message. linkedom lacks HTMLFormElement named access (form.attend), so shim
  // the standard browser behaviour before dispatching.
  const form = document.querySelector('#rsvpForm');
  if (form) {
    Object.defineProperty(form, 'attend', {
      get() {
        const checked = form.querySelector('input[name="attend"]:checked') || form.querySelector('input[name="attend"]');
        return { value: checked ? checked.value : '' };
      },
    });
    const nameInput = document.querySelector('#rsvpName');
    if (nameInput) nameInput.value = 'Smoke Guest';
    trap(() => form.dispatchEvent(new window.Event('submit')));
    flushFrames();
    if (!posted.some((m) => m && m.type === 'vinvite:rsvp')) {
      errors.push(new Error('RSVP submit did not post a vinvite:rsvp message'));
    }
  }

  return { errors, document };
}

const only = process.argv[2];
const names = (only ? [only] : fs.readdirSync(TEMPLATES_DIR)).filter((n) =>
  fs.existsSync(path.join(TEMPLATES_DIR, n, 'template.html')),
);
if (names.length === 0) { console.error('no templates found'); process.exit(1); }

let failed = false;
for (const name of names) {
  const { errors, document } = smoke(name);
  if (errors.length) {
    failed = true;
    console.error(`✗ ${name}: ${errors.length} runtime error(s)`);
    for (const e of errors) console.error('  ' + String(e.stack || e).split('\n').slice(0, 3).join('\n  '));
    continue;
  }
  // The scene must actually be wired up, not merely error-free.
  const unbound = document.querySelectorAll('[data-bind],[data-t]').length === 0;
  const blank = [...document.querySelectorAll('[data-t]')].some((n) => !n.textContent.trim());
  if (unbound || blank) {
    failed = true;
    console.error(`✗ ${name}: template rendered but text bindings are empty`);
    continue;
  }
  console.log(`✓ ${name}: no runtime errors, bindings applied`);
}
process.exit(failed ? 1 : 0);
