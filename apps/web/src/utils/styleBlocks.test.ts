import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * No `<style>{`…`}</style>` block may contain a BACKTICK.
 *
 * It lives in a template literal, so one backtick — even inside a prose comment
 * with a code span in it — ends the literal, and the file stops compiling. That
 * has now happened twice: once in `OwnerCabinetPage` (which shipped) and once
 * in `SmallBanquetOrderSheet`, where a comment explained `auto-fill` in code
 * quotes. Both had a test afterwards, on their own file.
 *
 * This replaces those one-file tripwires with one that covers every page there
 * is and every page there will be — the trap is a property of the pattern, not
 * of the two files that fell into it. `tsc` does catch it, which is how both
 * were found, but it catches it as a cascade of twenty syntax errors a few
 * lines apart from the real cause; this says what is wrong.
 */
const WEB = join(__dirname, '..');

/** Every .tsx/.ts under src, which is small enough to read whole. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sources(path, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path);
    }
  }
  return out;
}

/** The body of each inline style block in a file. */
function styleBodies(code: string): string[] {
  return [...code.matchAll(/<style>\{`(.*?)`\}<\/style>/gs)].map((m) => m[1]);
}

const files = sources(WEB);

describe('inline style blocks', () => {
  it('there are some, so this test is actually looking at something', () => {
    // A rename of the pattern (a styled-components move, say) must not leave
    // this passing over nothing.
    const withStyles = files.filter((file) => styleBodies(readFileSync(file, 'utf8')).length > 0);
    expect(withStyles.length).toBeGreaterThan(3);
  });

  it('none contains a backtick', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const body of styleBodies(readFileSync(file, 'utf8'))) {
        if (body.includes('`')) offenders.push(file.slice(WEB.length + 1));
      }
    }
    expect(offenders, `a backtick ends the template literal: ${offenders.join(', ')}`).toEqual([]);
  });

  it('and every block that opens is closed', () => {
    // An unbalanced opener means the regex above silently measured the wrong
    // span — and that a file is already broken.
    for (const file of files) {
      const code = readFileSync(file, 'utf8');
      const openers = (code.match(/<style>\{`/g) ?? []).length;
      const closers = (code.match(/`\}<\/style>/g) ?? []).length;
      expect(closers, file.slice(WEB.length + 1)).toBe(openers);
    }
  });
});
