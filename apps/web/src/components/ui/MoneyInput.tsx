import type { CSSProperties } from 'react';
import { groupDigits } from '../../utils/currency';

/**
 * An amount field whose digits are grouped by place value: `250 000`, not
 * `250000`.
 *
 * Six or seven digits without separators cannot be read at a glance — the
 * difference between 250000 and 2500000 is one character in the middle of a
 * blur, and these are prices and payments. The expense ledger already did this
 * inline; every other amount field in the product was a bare number box.
 *
 * **`type="text"`, deliberately.** A `type="number"` input rejects the space, so
 * the grouping simply cannot exist inside one — which is why every field that
 * needed this had to stop being one. `inputMode="numeric"` keeps the numeric
 * keypad on a phone, which is the only thing `type="number"` was buying here.
 *
 * The value stays a **string** in the caller's state and is parsed at the point
 * of use (`parseSumToTiyin` / `parseWholeSum` already strip spaces). That is the
 * same rule the Menu page's autosave needed: a half-typed amount is an
 * unfinished number, not a commitment to whatever it currently parses as.
 *
 * `groupDigits` drops everything that is not a digit, so this is whole units
 * only — so'm, not tiyin, which is what every amount field here collects.
 */
export function MoneyInput({
  value, onChange, className = 'adm-input', placeholder, style, disabled, ariaLabel, onKeyDown,
}: {
  value: string;
  onChange: (grouped: string) => void;
  className?: string;
  placeholder?: string;
  style?: CSSProperties;
  disabled?: boolean;
  ariaLabel?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      value={groupDigits(value)}
      onChange={(e) => onChange(groupDigits(e.target.value))}
    />
  );
}
