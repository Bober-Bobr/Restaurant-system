import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate, locales, type Locale } from '../utils/translate';
import { buildSubdomainUrl, isRootDomain, toSubdomainSlug } from '../utils/subdomain';
import logoSrc from '../assets/networking-logo.png';

const formatRequestError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU', uz: 'UZ' };

export const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const { locale, setLocale } = useAdminStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const redirectAfterLogin = (data: { accessToken: string; refreshToken: string; username: string; expiresIn: number; role: import('../store/auth.store').AdminRole; restaurantId: string | null; restaurantName?: string | null }) => {
    setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId, data.restaurantName);
    if (isRootDomain() && data.role === 'CHIEF_ADMIN') {
      window.location.href = buildSubdomainUrl('admin', {
        _at: data.accessToken, _rt: data.refreshToken, _u: data.username, _r: data.role,
        _rid: '', _rn: '', _exp: String(data.expiresIn),
      });
    } else if (isRootDomain() && data.role === 'OWNER') {
      window.location.href = buildSubdomainUrl('cabinet', {
        _at: data.accessToken, _rt: data.refreshToken, _u: data.username, _r: data.role,
        _rid: data.restaurantId ?? '', _rn: data.restaurantName ?? '', _exp: String(data.expiresIn),
      });
    } else if (isRootDomain() && data.restaurantName) {
      const slug = toSubdomainSlug(data.restaurantName);
      window.location.href = buildSubdomainUrl(slug, {
        _at: data.accessToken, _rt: data.refreshToken, _u: data.username, _r: data.role,
        _rid: data.restaurantId ?? '', _rn: data.restaurantName ?? '', _exp: String(data.expiresIn),
      });
    } else {
      navigate('/', { replace: true });
    }
  };

  const loginMutation = useMutation({
    mutationFn: () => authService.login(username.trim(), password),
    onSuccess: redirectAfterLogin,
  });

  const pending = loginMutation.isPending;
  const errorMessage = loginMutation.isError ? formatRequestError(loginMutation.error) : null;
  const canSubmit = username.trim().length > 0 && password.length > 0;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !canSubmit) return;
    loginMutation.mutate();
  };

  return (
    <main className="adm-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>

        {/* Language switcher */}
        <div className="tablet-fade-in" style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 24 }}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              style={{
                padding: '5px 12px',
                border: '1px solid',
                borderColor: locale === loc ? 'rgba(201,164,44,0.6)' : 'rgba(255,255,255,0.12)',
                borderRadius: 6,
                background: locale === loc ? 'rgba(201,164,44,0.15)' : 'rgba(255,255,255,0.04)',
                color: locale === loc ? '#c9a42c' : 'rgba(226,232,240,0.7)',
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

        {/* Logo + title */}
        <div className="scale-in" style={{ textAlign: 'center', marginBottom: 28 }}>
          <img className="adm-float" src={logoSrc} alt="Logo"
            style={{ height: 160, width: 'auto', maxWidth: '70%', objectFit: 'contain', display: 'block', margin: '0 auto 18px' }} />
          <h1 className="adm-title" style={{ margin: '0 0 6px', fontSize: 26 }}>{t('sign_in')}</h1>
          <p style={{ margin: 0, color: 'rgba(226,232,240,0.55)', fontSize: 14 }}>{t('login_subtitle')}</p>
        </div>

        {/* Form card */}
        <form
          onSubmit={submit}
          className="adm-card tablet-fade-up"
          style={{ padding: 28, display: 'grid', gap: 18, animationDelay: '120ms' }}
        >
          <label style={{ display: 'grid', gap: 8 }}>
            <span className="adm-label">{t('username')}</span>
            <input
              className="adm-input"
              autoComplete="username"
              placeholder={t('username_placeholder')}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span className="adm-label">{t('password')}</span>
            <div style={{ position: 'relative' }}>
              <input
                className="adm-input"
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
                  color: 'rgba(226,232,240,0.55)', padding: 6, borderRadius: 4,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c9a42c'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(226,232,240,0.55)'; }}
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
            className="adm-btn-primary"
            style={{ marginTop: 6, padding: '12px 16px', fontSize: 15 }}
          >
            {pending ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 0.9s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                {t('signing_in')}
              </>
            ) : (
              t('sign_in')
            )}
          </button>

          {errorMessage && (
            <div className="tablet-fade-in" style={{
              padding: '10px 14px',
              background: 'rgba(220,38,38,0.12)',
              border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 8,
              color: '#fca5a5',
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
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
};
