import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { onSaveSettled, saveState, shouldSave, signature, type AutosaveSnapshot } from './autosave';

/**
 * Removing a Save button removes the moment the writer said "now". These are the
 * guarantees that moment used to provide, and they are the same four rules the
 * Menu page's dish rows and the NFC plaque builder each arrived at separately.
 */
const SRC = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const snap = (over: Partial<AutosaveSnapshot> = {}): AutosaveSnapshot =>
  ({ current: 'A', saved: 'A', pending: null, failed: null, ...over });

describe('when a write is worth starting', () => {
  it('not when nothing has changed', () => {
    // A form that writes on every render writes once per visit for no reason,
    // and on a shared row that is somebody else's edit overwritten.
    expect(shouldSave(snap())).toBe(false);
  });

  it('yes once the value differs from what the server has', () => {
    expect(shouldSave(snap({ current: 'B' }))).toBe(true);
  });

  it('not when the same bytes are already in flight', () => {
    // Two identical writes race, and the loser's response can mark stale state
    // as saved.
    expect(shouldSave(snap({ current: 'B', pending: 'B' }))).toBe(false);
  });

  it('but yes when something changed WHILE a write was in flight', () => {
    expect(shouldSave(snap({ current: 'C', pending: 'B' }))).toBe(true);
  });

  it('not when this exact value has already been refused', () => {
    // A taken name or an expired session fails again — every debounce period,
    // for as long as the tab is open.
    expect(shouldSave(snap({ current: 'B', failed: 'B' }))).toBe(false);
  });

  it('and yes again as soon as the writer changes something', () => {
    // Editing is the only thing that can make a refused write succeed, so it is
    // what re-arms it.
    expect(shouldSave(snap({ current: 'C', failed: 'B' }))).toBe(true);
  });
});

describe('what a completed write marks saved', () => {
  it('the signature the REQUEST carried, not the one on screen', () => {
    // The bug this prevents: marking the current state saved discards, silently,
    // everything typed while the request was in flight. The writer sees "Saved"
    // over edits that never left the browser.
    const after = onSaveSettled(snap({ current: 'C', pending: 'B' }), 'B', true);
    expect(after.saved).toBe('B');
    expect(after.current).toBe('C');
    expect(shouldSave(after)).toBe(true);
  });

  it('a failure leaves the last good save alone and remembers the refusal', () => {
    const after = onSaveSettled(snap({ current: 'B', saved: 'A', pending: 'B' }), 'B', false);
    expect(after.saved).toBe('A');
    expect(after.failed).toBe('B');
    expect(shouldSave(after)).toBe(false);
  });

  it('a success clears an earlier failure', () => {
    const after = onSaveSettled(snap({ current: 'C', pending: 'C', failed: 'B' }), 'C', true);
    expect(after.failed).toBeNull();
  });
});

describe('what the writer is shown', () => {
  it('nothing at all on an untouched form', () => {
    // A row nobody has touched should not announce that it has no unsaved
    // changes.
    expect(saveState(snap(), false)).toBe('idle');
  });

  it('saved, once something actually has been', () => {
    expect(saveState(snap(), true)).toBe('saved');
  });

  it('dirty while the write is still pending, in flight while it runs', () => {
    expect(saveState(snap({ current: 'B' }), true)).toBe('dirty');
    expect(saveState(snap({ current: 'B', pending: 'B' }), true)).toBe('saving');
  });

  it('an error only while the refused value is still on screen', () => {
    expect(saveState(snap({ current: 'B', failed: 'B' }), true)).toBe('error');
    // Edited past the refusal: it is dirty again, not still failing.
    expect(saveState(snap({ current: 'C', failed: 'B' }), true)).toBe('dirty');
  });
});

describe('the signature', () => {
  it('does not care what order the keys arrived in', () => {
    // A value rebuilt from a server response has its keys in a different order
    // from the same value assembled in the editor. Without this, every form
    // would be dirty on arrival and write once per visit.
    expect(signature({ a: 1, b: 2 })).toBe(signature({ b: 2, a: 1 }));
    expect(signature({ x: { p: 1, q: 2 } })).toBe(signature({ x: { q: 2, p: 1 } }));
  });

  it('tells "cleared" apart from "never set"', () => {
    // `JSON.stringify` drops undefined keys, so without normalising, clearing a
    // colour signed identically to never having set one — and the change looked
    // as though it had silently failed. Exactly the plaqueDraft bug.
    expect(signature({ a: 1, b: undefined })).toBe(signature({ a: 1, b: null }));
    expect(signature({ a: 1, b: null })).not.toBe(signature({ a: 1 }));
  });

  it('keeps array order, which is meaningful', () => {
    expect(signature([1, 2])).not.toBe(signature([2, 1]));
  });
});

describe('the hook wires those rules to a real form', () => {
  const hook = read('hooks/useAutosave.ts');

  it('flushes on unmount and on the page being hidden', () => {
    // `beforeunload` is unreliable on mobile Safari and these are tools used on
    // a phone; without the flush the last 900ms of typing dies with the tab.
    expect(hook).toContain("document.addEventListener('visibilitychange', flush)");
    expect(hook).toContain("window.addEventListener('pagehide', run)");
    expect(hook).toContain('run();   // unmount');
  });

  it('reads the latest value from a ref, not from the render that scheduled it', () => {
    expect(hook).toContain('const payload = latest.current;');
  });

  it('offers a retry, since it will not re-attempt a refusal on its own', () => {
    expect(hook).toContain('retry: () => { snap.current = { ...snap.current, failed: null }; run(); }');
  });

  it('writes nothing when disabled', () => {
    // A closed form, or a row nobody is editing, must not commit a stale value
    // under somebody.
    expect(hook).toContain('if (!enabled) return;');
  });
});

describe('a NumberField still looks like the form it is in', () => {
  it('forwards a className, because it is otherwise unstyled', () => {
    // It renders a bare `<input>`. Replacing a styled input with one of these
    // dropped the field to the browser's default chrome — which is what happened
    // to the Hot appetizer count when it stopped being an `.adm-input`.
    const src = read('components/ui/NumberField.tsx');
    expect(src).toContain('className?: string;');
    expect(src).toContain('className={className}');
  });

  it('and every admin call site passes one', () => {
    const src = read('pages/AdminTableCategoriesPage.tsx');
    const fields = src.match(/<NumberField[^>]*>/g) ?? [];
    expect(fields.length).toBeGreaterThan(0);
    for (const field of fields) expect(field, field).toContain('className="adm-input"');
  });
});

describe('the pages converted so far', () => {
  // Every page whose EDIT form is autosaved. The arrangement page is covered
  // separately below: it has no editor to open, so a drag is the edit.
  const PAGES = [
    'pages/AdminHallsPage.tsx',
    'pages/AdminExtraServicesPage.tsx',
    'pages/AdminTableCategoriesPage.tsx',
    'pages/AdminSubcategoriesPage.tsx',
  ];

  for (const page of PAGES) {
    it(`${page} autosaves its editor and has no Save button`, () => {
      const src = read(page);
      expect(src).toContain('useAutosave({');
      expect(src).toContain('<AutosaveStatus');
      expect(src, 'a Save button is still there').not.toMatch(/\{t\('saving'\) : t\('save'\)\}/);
    });

    it(`${page} refuses to write a value that is not yet valid`, () => {
      // Autosave sees every keystroke on the way to a value; a Save button only
      // ever saw the finished one.
      const src = read(page);
      // The payload is computed, can be null, and the hook is told — so nothing
      // is written while the row is mid-edit. How the guard is spelled (an early
      // `return null` or a ternary) is the page's business.
      expect(src).toContain('const editPayload = useMemo(');
      expect(src, 'the payload can never be null').toMatch(/(return null;|: null)/);
      expect(src).toContain('enabled: editPayload !== null,');
    });

    it(`${page} no longer closes the editor when a write lands`, () => {
      // Saving and "I am finished with this row" stopped being the same event.
      const src = read(page);
      const mutation = src.slice(src.indexOf('const updateMutation'));
      expect(mutation.slice(0, mutation.indexOf('});'))).not.toContain('setEditingId(null)');
    });
  }

  it('the arrangement page saves a drag, and only a real one', () => {
    // Both sections. `dirty` gates the payload, because an arrangement page that
    // wrote on mount would rewrite the order it was handed on every visit — a
    // write nobody asked for, on a table several people share.
    const src = read('pages/AdminArrangementAdminPage.tsx');
    expect((src.match(/useAutosave\(\{/g) ?? []).length).toBe(2);
    expect((src.match(/<AutosaveStatus/g) ?? []).length).toBe(2);
    expect(src).not.toMatch(/t\('save_arrangement'\)/);
    expect((src.match(/dirty && /g) ?? []).length).toBe(2);
  });

  it('a refetch cannot overwrite an order still being dragged', () => {
    // Saving invalidates the query, so the reset effect fires again with the
    // server's copy. Same rule as `mayAcceptServerValue` on the Menu page.
    const src = read('pages/AdminArrangementAdminPage.tsx');
    expect((src.match(/dirtyRef\.current/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('the CREATE forms keep their button, deliberately', () => {
    // A create form that wrote on a keystroke would leave a trail of half-typed
    // rows. Those get a session draft instead — see useSessionDraft.
    for (const page of PAGES) {
      expect(read(page), page).toMatch(/createMutation/);
    }
  });
});
