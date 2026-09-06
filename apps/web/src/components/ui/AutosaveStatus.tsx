import type { SaveState } from '../../hooks/autosave';
import type { translate } from '../../utils/translate';

/**
 * What replaces the Save button.
 *
 * A form with no button and no feedback gives the writer nothing to trust: they
 * cannot tell a saved edit from one still sitting in the browser, so they either
 * wait for something that never comes or leave and hope. The states are the four
 * that matter — pending, in flight, written, refused.
 *
 * The error state carries a **Retry**, because it is the only way back: autosave
 * deliberately does not re-attempt a payload that just failed, or a permanent
 * error (a taken name, an expired session) would be retried every debounce
 * period for as long as the tab is open.
 *
 * `idle` renders nothing. A row nobody has touched should not be announcing that
 * it has no unsaved changes.
 */
export function AutosaveStatus({ state, onRetry, t }: {
  state: SaveState;
  onRetry: () => void;
  t: (key: Parameters<typeof translate>[0]) => string;
}) {
  if (state === 'idle') return null;

  const label = state === 'saving' ? t('saving')
    : state === 'saved' ? t('autosave_saved')
    : state === 'error' ? t('autosave_failed')
    : t('autosave_pending');

  const color = state === 'error' ? '#f87171'
    : state === 'saved' ? '#4ade80'
    : 'rgba(var(--adm-text-rgb), 0.6)';

  return (
    <span
      // Announced, not just coloured: the whole point is that nobody pressed
      // anything, so the change has to reach a screen reader on its own.
      role="status"
      aria-live="polite"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color }}
    >
      {label}
      {state === 'error' && (
        <button type="button" onClick={onRetry}
          style={{
            padding: '3px 10px', borderRadius: 8, cursor: 'pointer',
            fontSize: 12, fontWeight: 700, color: 'var(--adm-accent)',
            background: 'rgba(var(--adm-accent-rgb),0.12)',
            border: '1px solid rgba(var(--adm-accent-rgb),0.4)',
          }}>
          {t('retry')}
        </button>
      )}
    </span>
  );
}
