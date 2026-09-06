import { useCallback, useEffect, useRef, useState } from 'react';
import { onSaveSettled, saveState, shouldSave, signature, type AutosaveSnapshot, type SaveState } from './autosave';

/** Same debounce the Menu page and the plaque builder settled on. */
export const AUTOSAVE_MS = 900;

/**
 * Replace a Save button with a write that happens on its own.
 *
 * The caller hands over the value being edited and a function that writes it.
 * Everything the button used to guarantee is handled here: see `autosave.ts` for
 * the four rules, which are pure and tested separately.
 *
 * Three things are deliberate:
 *
 * - **The debounce is flushed on `visibilitychange` → hidden and on unmount.**
 *   `beforeunload` is unreliable on mobile Safari, and these are tools used on a
 *   phone. Without the flush, the last 900 ms of typing is lost to closing a tab.
 * - **A failed write is not retried until something changes.** A permanent error
 *   would otherwise be retried every 900 ms for as long as the tab is open. The
 *   caller gets `retry()` — the only way back from a failure, and it is a
 *   deliberate press rather than a machine hammering an endpoint.
 * - **`enabled: false` means no writes at all**, so a form that is closed, or a
 *   row nobody is editing, cannot write. Autosave with no visible form is how a
 *   stale value gets committed under someone.
 */
export function useAutosave<T>({ value, save, enabled = true, delay = AUTOSAVE_MS }: {
  value: T;
  save: (value: T) => Promise<unknown>;
  enabled?: boolean;
  delay?: number;
}): { state: SaveState; retry: () => void; flush: () => void } {
  const current = signature(value);

  // Everything the scheduler reads lives in refs: a save fired from a timer or
  // an unmount must see the latest state, not the render that scheduled it.
  const snap = useRef<AutosaveSnapshot>({ current, saved: current, pending: null, failed: null });
  const latest = useRef(value);
  const saveFn = useRef(save);
  const everSaved = useRef(false);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => n + 1), []);

  snap.current.current = current;
  latest.current = value;
  saveFn.current = save;

  const run = useCallback(() => {
    if (!shouldSave(snap.current)) return;
    const sent = snap.current.current;
    const payload = latest.current;
    snap.current = { ...snap.current, pending: sent };
    rerender();
    saveFn.current(payload)
      .then(() => { everSaved.current = true; snap.current = onSaveSettled(snap.current, sent, true); })
      .catch(() => { snap.current = onSaveSettled(snap.current, sent, false); })
      .finally(rerender);
  }, [rerender]);

  // The debounce. Re-armed on every change, so a burst of typing writes once.
  useEffect(() => {
    if (!enabled) return;
    if (!shouldSave(snap.current)) return;
    const timer = setTimeout(run, delay);
    return () => clearTimeout(timer);
  }, [current, enabled, delay, run]);

  // Leaving the page — closing the tab, switching apps, navigating away — must
  // not cost the last edit. `pagehide` fires where `beforeunload` does not.
  useEffect(() => {
    if (!enabled) return;
    const flush = () => { if (document.visibilityState === 'hidden') run(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', run);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('pagehide', run);
      run();   // unmount: the form is going away with unsaved edits in it
    };
  }, [enabled, run]);

  return {
    state: enabled ? saveState(snap.current, everSaved.current) : 'idle',
    // Clearing `failed` is what makes the same bytes eligible again.
    retry: () => { snap.current = { ...snap.current, failed: null }; run(); },
    flush: run,
  };
}
