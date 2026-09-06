/**
 * The rules a Save button was doing for you, written down.
 *
 * Two autosaves already exist in this repo — the Menu page's dish rows
 * (`adminMenuDraft.ts`) and the NFC plaque builder (`plaqueDraft.ts`) — and both
 * arrived at the same four rules the hard way. This is that shared half, kept
 * pure so it can be tested without a timer or a component.
 *
 * Removing the button removes the moment the writer said "now". Everything below
 * is about recovering what that moment used to guarantee.
 */

/** What the autosave is doing, for the caller to show. */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export type AutosaveSnapshot = {
  /** Signature of the state as it is now. */
  current: string;
  /** Signature last confirmed by the server. */
  saved: string;
  /** Signature of the request in flight, if any. */
  pending: string | null;
  /** Signature that failed and has not changed since. */
  failed: string | null;
};

/**
 * Should a write be started for this state?
 *
 * - **Nothing changed** — a form that writes on every render writes once per
 *   visit for no reason, and on a shared row that is a lost edit for somebody.
 * - **The same bytes are already in flight** — two identical writes race, and
 *   the loser's response can mark stale state as saved.
 * - **This exact state already failed** — a taken name or an expired session
 *   fails again, every debounce period, for as long as the tab is open. It is
 *   retried when the writer CHANGES something, which is the only thing that can
 *   make it succeed.
 */
export function shouldSave(snap: AutosaveSnapshot): boolean {
  if (snap.current === snap.saved) return false;
  if (snap.current === snap.pending) return false;
  if (snap.current === snap.failed) return false;
  return true;
}

/**
 * What to mark saved when a request completes.
 *
 * The signature the REQUEST carried, never the one on screen. Marking the
 * current state saved discards, silently, everything typed while the request was
 * in flight — the writer sees "Saved" over edits that never left the browser.
 */
export function onSaveSettled(snap: AutosaveSnapshot, sentSignature: string, ok: boolean): AutosaveSnapshot {
  return {
    current: snap.current,
    saved: ok ? sentSignature : snap.saved,
    pending: null,
    failed: ok ? null : sentSignature,
  };
}

/** The state to show, derived from the same snapshot the scheduler reads. */
export function saveState(snap: AutosaveSnapshot, everSaved: boolean): SaveState {
  if (snap.pending !== null) return 'saving';
  if (snap.failed !== null && snap.current === snap.failed) return 'error';
  if (snap.current !== snap.saved) return 'dirty';
  return everSaved ? 'saved' : 'idle';
}

/**
 * A stable signature for a form's contents.
 *
 * Keys are sorted, because `JSON.stringify` follows insertion order and a value
 * rebuilt from a server response has its keys in a different order from the same
 * value assembled in the editor — which would make an untouched form dirty on
 * arrival and write once per visit.
 *
 * `undefined` is normalised to null for the same reason: `JSON.stringify` drops
 * undefined keys entirely, so "cleared" and "never set" would sign identically
 * and clearing a field would look like no change at all.
 */
export function signature(value: unknown): string {
  return JSON.stringify(normalise(value));
}

function normalise(value: unknown): unknown {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(normalise);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = normalise(source[key]);
    return out;
  }
  return value;
}
