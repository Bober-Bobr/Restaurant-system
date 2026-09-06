import { useEffect, useRef, useState } from 'react';

/**
 * Form state that survives a reload or a browser Back, and nothing more.
 *
 * A form the visitor has half-filled is work. `useState` throws it away on any
 * navigation the browser treats as a page load — the Back button out of a photo
 * picker, a stray refresh, an accidental swipe — and the visitor has no idea it
 * is gone until they look.
 *
 * **Session storage, deliberately.** The draft dies with the tab, so it cannot
 * outlive the sitting that produced it. `localStorage` would resurrect a
 * half-typed event a week later on a machine several people share, which is a
 * worse failure than losing it: a stale draft looks like real data.
 *
 * This is NOT a save. Nothing reaches the database until the form is submitted —
 * see `useAutosave` for the pages where a field IS the save. A create form must
 * not write on a keystroke, and this is what those forms get instead.
 *
 * Storage is wrapped because it throws outright in some contexts (Safari private
 * mode, a browser set to block site data). A draft that cannot be kept is not a
 * reason to break the form it belongs to.
 */
export function readSessionDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionDraft(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch { /* a draft that cannot be kept must not break the form */ }
}

export function clearSessionDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch { /* see above */ }
}

/**
 * `useState`, plus the value is restored on mount and written back on change.
 *
 * The initial value is read ONCE, in the state initialiser: reading it in an
 * effect would render the empty form first and overwrite anything the visitor
 * managed to type in that frame.
 */
export function useSessionDraft<T>(key: string, initial: T): [T, (value: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => readSessionDraft<T>(key) ?? initial);

  // Skip the write caused by the restore itself — it would rewrite the same
  // bytes on every mount, and on a quota-limited browser that is a wasted throw.
  const restored = useRef(true);
  useEffect(() => {
    if (restored.current) { restored.current = false; return; }
    writeSessionDraft(key, value);
  }, [key, value]);

  return [value, setValue, () => { clearSessionDraft(key); restored.current = true; }];
}
