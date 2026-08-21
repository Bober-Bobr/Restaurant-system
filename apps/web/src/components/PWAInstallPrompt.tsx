import { useEffect, useState } from 'react';
import { translate, type Locale } from '../utils/translate';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // Catch tablets without "Mobile" in UA (e.g. iPad on iPadOS 13+)
  if (navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 1024px)').matches) return true;
  return false;
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function recentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch { return false; }
}

export const PWAInstallPrompt = ({ locale }: { locale: Locale }) => {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone() || recentlyDismissed()) return;

    if (isIOS()) {
      setIos(true);
      setShow(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    } else {
      dismiss();
    }
    setDeferredPrompt(null);
  };

  if (!show) return null;

  return (
    <div
      className="scale-in"
      style={{
        position: 'fixed',
        left: 16, right: 16, bottom: 16,
        zIndex: 50,
        maxWidth: 460, margin: '0 auto',
        padding: 16,
        borderRadius: 18,
        background: 'rgba(var(--adm-bg-rgb),0.95)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(var(--adm-accent-rgb),0.35)',
        boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <img
        src="/pwa-icon-192.png"
        alt=""
        style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: 14 }}>
          {t('install_app')}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.65)', lineHeight: 1.4 }}>
          {ios ? t('install_ios_hint') : t('install_app_desc')}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!ios && (
          <button
            type="button"
            onClick={install}
            style={{
              padding: '8px 14px', fontSize: 12, fontWeight: 700,
              borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, var(--adm-accent) 0%, #d4af37 100%)',
              color: '#1a3320', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t('install_app')}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          style={{
            padding: '6px 12px', fontSize: 11, fontWeight: 600,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(226,232,240,0.6)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {t('later')}
        </button>
      </div>
    </div>
  );
};
