import type { KioskSession } from '../utils/kioskSession';
import type { translate } from '../utils/translate';

/**
 * "Which evening is this?" — the first thing the Small Banquets kiosk asks.
 *
 * Two cards, full screen, above everything else. It is a fork in the whole
 * visit rather than a setting, so it is not a field on a form: picking Banquet
 * opens the section's booking flow, picking General Dining goes straight to
 * the booking summary with no menu, no packages and no prices.
 *
 * Shown only where the kiosk actually has two (utils/kioskSession.ts). The
 * banquet kiosk never sees it, and neither does a Small Banquets restaurant
 * that does not run General Dining.
 */

type Props = {
  sessions: KioskSession[];
  onPick: (session: KioskSession) => void;
  t: (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;
};

const CARD: Record<KioskSession, { title: Parameters<typeof translate>[0]; body: Parameters<typeof translate>[0]; icon: string }> = {
  banquet: {
    title: 'kiosk_session_banquet',
    body: 'kiosk_session_banquet_hint',
    // A laid table.
    icon: 'M3 10h18M5 10V7a2 2 0 012-2h10a2 2 0 012 2v3M6 10v9m12-9v9M9 14h6',
  },
  dining: {
    title: 'kiosk_session_dining',
    body: 'kiosk_session_dining_hint',
    // Cover and cutlery.
    icon: 'M4 4v7a2 2 0 002 2h0a2 2 0 002-2V4M6 13v7M14 20V4a4 4 0 014 4v6h-4',
  },
};

export const KioskSessionChooser = ({ sessions, onPick, t }: Props) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-label={t('kiosk_session_title')}
    style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      // The kiosk's own ink, so this follows the section's palette rather than
      // being painted a colour of its own — the mistake the welcome overlay
      // made with its hardcoded dark green.
      background: 'linear-gradient(160deg, rgba(var(--rg-bg-rgb),0.97) 0%, rgba(var(--rg-bg-dark-rgb),0.97) 100%)',
      padding: 20,
    }}
  >
    <div className="w-full" style={{ maxWidth: 860 }}>
      <div className="text-center" style={{ marginBottom: 'clamp(20px, 4vh, 38px)' }}>
        <p className="rg-label" style={{ marginBottom: 10 }}>{t('kiosk_session_eyebrow')}</p>
        <h1 className="rg-display" style={{ color: 'white', fontSize: 'clamp(26px, 4.4vw, 40px)', lineHeight: 1.15 }}>
          {t('kiosk_session_title')}
        </h1>
        <p style={{ marginTop: 12, color: 'rgba(255,255,255,0.55)', fontSize: 'clamp(13px, 1.6vw, 15px)' }}>
          {t('kiosk_session_subtitle')}
        </p>
      </div>

      <div className="kiosk-session-grid grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(sessions.length, 2)}, minmax(0, 1fr))` }}>
        {sessions.map((session) => {
          const card = CARD[session];
          return (
            <button
              key={session}
              type="button"
              onClick={() => onPick(session)}
              className="rg-card text-left"
              style={{
                padding: 'clamp(18px, 3vw, 28px)', cursor: 'pointer',
                display: 'grid', gap: 12, alignContent: 'start',
                minHeight: 'clamp(180px, 26vh, 260px)',
              }}
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center"
                style={{
                  width: 52, height: 52, borderRadius: 6,
                  background: 'rgba(var(--rg-accent-rgb),0.14)',
                  border: '1px solid rgba(var(--rg-accent-rgb),0.35)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--rg-accent)" strokeWidth="1.7"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d={card.icon} />
                </svg>
              </span>
              <span className="rg-display" style={{ color: 'white', fontSize: 'clamp(19px, 2.6vw, 26px)' }}>
                {t(card.title)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.58)', fontSize: 'clamp(12px, 1.5vw, 14px)', lineHeight: 1.5 }}>
                {t(card.body)}
              </span>
              <span style={{ color: 'var(--rg-accent)', fontWeight: 700, fontSize: 14, letterSpacing: '0.04em' }}>
                {t('kiosk_session_start')} →
              </span>
            </button>
          );
        })}
      </div>
    </div>

    {/* The column count is inline (it follows how many sessions there are), so
        the phone override needs !important to win against it. Scoped to this
        grid's own class — `[role=dialog] .grid` would reach every other dialog
        the kiosk puts on screen. */}
    <style>{`
      @media (max-width: 640px) {
        .kiosk-session-grid { grid-template-columns: minmax(0, 1fr) !important; }
      }
    `}</style>
  </div>
);
