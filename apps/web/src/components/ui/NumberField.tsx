import { useState, type CSSProperties } from 'react';

// ── A number input you can actually empty ────────────────────────────────────
// `<input type="number" value={n} onChange={e => set(Number(e.target.value))}>`
// has a trap: clearing the box gives `''`, `Number('') === 0`, so the state
// becomes 0 and React writes "0" straight back into the field. The digit cannot
// be deleted — every backspace re-renders another zero.
//
// The fix is to let the field hold text that is not yet a number. While the
// visitor is typing, the raw string wins; the committed value only changes when
// the text parses. Leaving the field empty commits nothing, and blurring puts
// the last good value back, so a half-typed edit can always be abandoned.

/**
 * What a box's text should commit, or null for "not a value yet".
 *
 * This is the whole fix in one place: empty text — the state you are in the
 * instant you finish deleting the digits — commits nothing, where
 * `Number('')` would have committed 0.
 */
export function commitValue(text: string): number | null {
  if (text.trim() === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function NumberField({
  value, onChange, min, max, step, style, disabled, ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  style?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  // null = not being edited, so the committed value is what shows.
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value);
        const next = commitValue(e.target.value);
        if (next !== null) onChange(next);
      }}
      // Blur ends the edit: whatever is committed is what the field shows, so
      // an empty or unparseable box cannot survive as a visible lie.
      onBlur={() => setDraft(null)}
    />
  );
}
