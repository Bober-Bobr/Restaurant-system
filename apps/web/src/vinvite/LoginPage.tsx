import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { vinviteService } from './api';
import { useVInviteStore } from './store';
import { useViT } from './i18n';
import { ViLogo, ViThemeToggle } from './VInviteApp';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, cfg: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function errMessage(e: unknown): string {
  if (axios.isAxiosError(e)) return (e.response?.data as { message?: string })?.message ?? e.message;
  if (e instanceof Error) return e.message;
  return 'Error';
}

// ── v-invite.uz/login — sign-in + registration portal ────────────────────────
export const ViLoginPage = () => {
  const t = useViT();
  const setAuth = useVInviteStore((s) => s.setAuth);
  const uiTheme = useVInviteStore((s) => s.uiTheme);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleRef = useRef<HTMLDivElement>(null);

  // Google Identity Services button (only when a client ID is configured).
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleRef.current) return;
    const el = googleRef.current;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (res) => {
          try {
            setBusy(true);
            const auth = await vinviteService.google(res.credential);
            setAuth(auth.accessToken, auth.refreshToken, auth.user);
          } catch (e) {
            setError(errMessage(e));
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(el, {
        theme: uiTheme === 'dark' ? 'filled_black' : 'outline',
        size: 'large', shape: 'pill', width: 320, text: 'continue_with',
      });
    };

    if (window.google?.accounts?.id) {
      render();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => { cancelled = true; el.innerHTML = ''; };
  }, [setAuth, uiTheme]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const auth = mode === 'login'
        ? await vinviteService.login({ identifier, password })
        : await vinviteService.register({ email: email.trim(), username: username.trim(), password });
      setAuth(auth.accessToken, auth.refreshToken, auth.user);
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, position: 'relative', overflow: 'hidden' }}>
      {/* Decorative floating cream/blue blobs */}
      <span className="vi-blob" style={{ width: 380, height: 380, top: '-90px', left: '-110px', background: 'var(--vi-accent-soft)', animationDelay: '0s' }} />
      <span className="vi-blob" style={{ width: 300, height: 300, bottom: '-70px', right: '-60px', background: 'rgba(217,168,90,0.22)', animationDelay: '2.2s' }} />
      <span className="vi-blob" style={{ width: 200, height: 200, top: '30%', right: '12%', background: 'var(--vi-accent-soft)', animationDelay: '4s' }} />

      <div style={{ position: 'absolute', top: 18, right: 18 }}><ViThemeToggle /></div>

      <div className="vi-card vi-fade-up" style={{ width: '100%', maxWidth: 420, padding: '34px 30px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <ViLogo size={44} />
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--vi-muted)', textAlign: 'center' }}>{t('tagline')}</p>
        </div>

        {/* Login / Register tabs */}
        <div style={{ display: 'flex', gap: 6, padding: 5, borderRadius: 14, background: 'var(--vi-bg-soft)', marginBottom: 22 }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                background: mode === m ? 'var(--vi-card)' : 'transparent',
                color: mode === m ? 'var(--vi-accent)' : 'var(--vi-muted)',
                boxShadow: mode === m ? 'var(--vi-shadow)' : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              {t(m)}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="vi-pop" key={mode} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'login' ? (
            <div>
              <label className="vi-label">{t('identifier')}</label>
              <input className="vi-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required />
            </div>
          ) : (
            <>
              <div>
                <label className="vi-label">{t('email')}</label>
                <input className="vi-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
              </div>
              <div>
                <label className="vi-label">{t('username')}</label>
                <input className="vi-input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" minLength={3} required />
              </div>
            </>
          )}
          <div>
            <label className="vi-label">{t('password')}</label>
            <input className="vi-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 6 : undefined} required />
          </div>

          {error && (
            <p className="vi-pop" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, fontSize: 13, background: 'rgba(220,38,38,0.1)', color: 'var(--vi-danger)' }}>{error}</p>
          )}

          <button type="submit" className="vi-btn vi-btn-primary" disabled={busy} style={{ padding: '12px 0', fontSize: 15 }}>
            {busy ? <span className="vi-spinner" style={{ width: 18, height: 18 }} /> : t(mode)}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
              <span style={{ flex: 1, height: 1, background: 'var(--vi-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--vi-muted)', fontWeight: 600 }}>{t('or')}</span>
              <span style={{ flex: 1, height: 1, background: 'var(--vi-border)' }} />
            </div>
            <div ref={googleRef} style={{ display: 'flex', justifyContent: 'center' }} />
          </>
        )}
      </div>
    </main>
  );
};
