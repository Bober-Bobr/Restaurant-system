import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { authService } from '../services/auth.service';
import { useAuthStore, type AdminRole } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate, locales, type Locale } from '../utils/translate';
import { buildNfcBuilderUrl } from '../utils/subdomain';
import { VC_LOGO } from './branding';

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

const formatRequestError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

// Roles allowed through the v-connect door. Everyone else is told to use the
// v-menu login instead of being silently dropped on a blank builder.
const NFC_ROLES: AdminRole[] = ['NFC_MAKER', 'CHIEF_ADMIN'];

// ── v-connect.uz/login ───────────────────────────────────────────────────────
// Mirrors the v-menu sign-in form (same fields, same show/hide toggle, same
// language switcher) in the black-and-beige v-connect skin. Deliberately has no
// subtitle line and none of v-menu's tablet/restaurant extras.
export const VConnectLoginPage = () => {
  const { setAuth } = useAuthStore();
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => authService.login(username.trim(), password),
    onSuccess: (data) => {
      if (!NFC_ROLES.includes(data.role)) {
        setRoleError(t('vc_no_access'));
        return;
      }
      setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId, data.restaurantName);
      // Hand the session to nfc.v-connect.uz using the same query protocol the
      // v-menu subdomains use (App.tsx consumes _at/_rt/_u/_r on first paint).
      window.location.href = buildNfcBuilderUrl({
        _at: data.accessToken,
        _rt: data.refreshToken,
        _u: data.username,
        _r: data.role,
        _rid: '',
        _rn: '',
        _exp: String(data.expiresIn),
      });
    },
  });

  const pending = loginMutation.isPending;
  const errorMessage = roleError ?? (loginMutation.isError ? formatRequestError(loginMutation.error) : null);
  const canSubmit = username.trim().length > 0 && password.length > 0;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !canSubmit) return;
    setRoleError(null);
    loginMutation.mutate();
  };

  return (
    <main className="vc-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>

        {/* Language switcher */}
        <div className="vc-fade-in" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 26 }}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              style={{
                padding: '5px 12px',
                border: '1px solid',
                borderColor: locale === loc ? 'var(--vc-accent)' : 'var(--vc-line)',
                borderRadius: 6,
                background: locale === loc ? 'var(--vc-accent-dim)' : 'transparent',
                color: locale === loc ? 'var(--vc-accent)' : 'var(--vc-beige-dim)',
                fontWeight: locale === loc ? 700 : 500,
                cursor: 'pointer',
                fontSize: 12,
                letterSpacing: '0.08em',
                transition: 'all 0.18s',
              }}
            >
              {LOCALE_LABELS[loc]}
            </button>
          ))}
        </div>

        {/* Mark + title. No subtitle line here by design. */}
        <div className="vc-fade-up" style={{ textAlign: 'center', marginBottom: 30 }}>
          <img
            src={VC_LOGO}
            alt="v-connect"
            style={{ height: 120, width: 'auto', maxWidth: '64%', objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
          />
          <hr className="vc-rule" style={{ marginBottom: 18 }} />
          <h1 className="vc-title">{t('sign_in')}</h1>
        </div>

        {/* Form card */}
        <form
          onSubmit={submit}
          className="vc-card vc-fade-up"
          style={{ padding: 26, display: 'grid', gap: 18, animationDelay: '110ms' }}
        >
          <label>
            <span className="vc-label">{t('username')}</span>
            <input
              className="vc-input"
              autoComplete="username"
              placeholder={t('username_placeholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label>
            <span className="vc-label">{t('password')}</span>
            <div style={{ position: 'relative' }}>
              <input
                className="vc-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={t('password_enter_placeholder')}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--vc-beige-dim)', padding: 6, borderRadius: 4,
                  display: 'flex', transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--vc-accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--vc-beige-dim)'; }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={pending || !canSubmit}
            className="vc-btn vc-btn-primary"
            style={{ marginTop: 4, padding: '13px 16px', fontSize: 14 }}
          >
            {pending ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'vcSpin 0.9s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {t('signing_in')}
              </>
            ) : (
              t('sign_in')
            )}
          </button>

          {errorMessage && (
            <div className="vc-fade-in" style={{
              padding: '10px 14px',
              background: 'rgba(224,122,106,0.1)',
              border: '1px solid rgba(224,122,106,0.35)',
              borderRadius: 8,
              color: 'var(--vc-danger)',
              fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {errorMessage}
            </div>
          )}
        </form>

        <p className="vc-muted" style={{ textAlign: 'center', marginTop: 22, fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase' }}>
          v-connect.uz
        </p>
      </div>
    </main>
  );
};
