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

/**
 * Pull `defaultConfig` out of a definition.ts without a bundler.
 *
 * TWO shapes are in the wild, and that is the whole reason this is not three
 * lines: most designs declare `const defaultConfig = {…}` above the definition,
 * and `wedding-fotiha` writes `defaultConfig: {…}` inline INSIDE it. Reading
 * only the first and returning `{}` for the second is not a smaller test — it
 * smoke-tested that design with no config at all, so every binding on the page
 * was empty and nothing here noticed, because the "bindings applied" check
 * below reads the fixed `[data-t]` chrome, which needs no config.
 *
 * So the object is found by its opening brace and taken by BALANCING braces,
 * skipping strings and comments — these files are full of both, and a brace in
 * an apostrophe or a prose comment would otherwise cut the config in half.
 */
function readDefaultConfig(definitionPath) {
  const src = fs.readFileSync(definitionPath, 'utf8');
  const found = /(?:const\s+defaultConfig\s*=|\bdefaultConfig\s*:)\s*\{/.exec(src);
  if (!found) return {};
  const open = src.indexOf('{', found.index);
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; if (i === 0) break; continue; }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i; break; }
  }
  if (end === -1) return {};
  const ts = 'const defaultConfig = ' + src.slice(open, end + 1) + ';\ndefaultConfig;';
  const js = require('esbuild').transformSync(ts, { loader: 'ts' }).code;
  return vm.runInNewContext(js);
}

/**
 * The same config with a DOUBLE WEDDING's second pair typed in.
 *
 * Every wedding design takes an optional second bride and groom, and with the
 * fields empty — which is what `defaultConfig` ships — none of that code runs
 * at all. So the default pass proves only that the feature is invisible; this
 * is the pass that proves it works.
 *
 * One spelling for all three languages, so a check on the rendered text does
 * not also depend on which language the template opens in.
 */
const SECOND = { groom: 'Bobur', bride: 'Nilufar' };
function withSecondCouple(config) {
  const say = (s) => ({ ru: s, uz: s, en: s });
  const couple = Object.assign({}, config.couple, {
    groom2: say(SECOND.groom),
    bride2: say(SECOND.bride),
  });
  // Only where the design asks the first pair for formal names, or the second
  // pair would be carrying a field its own template never reads.
  if (config.couple && config.couple.groomFull) {
    couple.groomFull2 = say(SECOND.groom + ' Qosimov');
    couple.brideFull2 = say(SECOND.bride + ' Qosimova');
  }
  return Object.assign({}, config, { couple });
}

function smoke(name, transform) {
  const dir = path.join(TEMPLATES_DIR, name);
  const htmlPath = path.join(dir, 'template.html');
  const config = transform
    ? transform(readDefaultConfig(path.join(dir, 'definition.ts')))
    : readDefaultConfig(path.join(dir, 'definition.ts'));

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

  return { errors, document, config };
}

/** Report one pass's runtime errors; true when it is clean. */
function report(label, errors) {
  if (!errors.length) return true;
  console.error(`✗ ${label}: ${errors.length} runtime error(s)`);
  for (const e of errors) console.error('  ' + String(e.stack || e).split('\n').slice(0, 3).join('\n  '));
  return false;
}

const only = process.argv[2];
const names = (only ? [only] : fs.readdirSync(TEMPLATES_DIR)).filter((n) =>
  fs.existsSync(path.join(TEMPLATES_DIR, n, 'template.html')),
);
if (names.length === 0) { console.error('no templates found'); process.exit(1); }

let failed = false;
for (const name of names) {
  const { errors, document, config } = smoke(name);
  if (!report(name, errors)) { failed = true; continue; }
  // A config that came back empty means the extractor above did not recognise
  // how this definition is written, and the page below was rendered with
  // nothing in it. That passed unnoticed for one design, so it is now a
  // failure rather than a quieter test.
  if (Object.keys(config).length === 0) {
    failed = true;
    console.error(`✗ ${name}: defaultConfig could not be read, so this page was rendered empty`);
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
  // With no second couple nothing of that feature may be on the page: the
  // class is what reveals every `.duo` element, so a page that carries it
  // without a second pair shows empty clusters and dangling separators.
  if (/^wedding-/.test(name) && /\bhas-duo\b/.test(document.documentElement.className || '')) {
    failed = true;
    console.error(`✗ ${name}: has-duo is set although no second couple was given`);
    continue;
  }
  console.log(`✓ ${name}: no runtime errors, bindings applied`);

  if (!/^wedding-/.test(name)) continue;

  // ── The same design again, as a DOUBLE WEDDING ──────────────────────────
  // The default pass above renders the feature switched off, so without this
  // one a second couple that throws, never appears, or never reaches the tab
  // title would pass every check we run.
  const duo = smoke(name, withSecondCouple);
  if (!report(`${name} (double wedding)`, duo.errors)) { failed = true; continue; }
  const problems = [];
  if (!/\bhas-duo\b/.test(duo.document.documentElement.className || '')) {
    problems.push('has-duo was never set, so every .duo element stays hidden');
  }
  const text = duo.document.body.textContent || '';
  for (const who of [SECOND.groom, SECOND.bride]) {
    if (!text.includes(who)) problems.push(`${who} is nowhere on the page`);
  }
  // And each element that belongs to the second pair holds the RIGHT name.
  //
  // "the name is somewhere on the page" is not enough on its own: most of
  // these designs also print both pairs as one joined line, so a hero that
  // silently filled the second couple's slots with the FIRST couple's names
  // passed — which is exactly what reverting one template's letter-splitter to
  // its old `bride ? bride : groom` test does.
  for (const [attr, who] of [['groom2', SECOND.groom], ['bride2', SECOND.bride]]) {
    const nodes = [
      ...duo.document.querySelectorAll(`[data-bind="${attr.replace('2', 'Name2')}"]`),
      ...duo.document.querySelectorAll(`[data-bind="${attr.replace('2', 'Full2')}"]`),
      ...duo.document.querySelectorAll(`[data-name="${attr}"]`),
    ];
    if (!nodes.length) { problems.push(`nothing is bound to the second ${attr}`); continue; }
    const wrong = nodes.filter((n) => !(n.textContent || '').includes(who));
    if (wrong.length) {
      problems.push(`${wrong.length}/${nodes.length} of the second ${attr}'s elements do not hold "${who}"`);
    }
  }
  // The tab title is the shared-link preview: naming one of two couples there
  // is the most visible way to half-ship this.
  if (!(duo.document.title || '').includes(SECOND.groom)) {
    problems.push('the tab title does not name the second couple');
  }
  if (problems.length) {
    failed = true;
    console.error(`✗ ${name} (double wedding): ${problems.join('; ')}`);
    continue;
  }
  console.log(`✓ ${name} (double wedding): second couple rendered`);
}
process.exit(failed ? 1 : 0);
