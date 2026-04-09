import { useMutation } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { defaultLocale, Locale, locales, translate } from '../utils/translate';
import logo from '../assets/logo.png';

export const AdminLayout = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      navigate('/login', { replace: true });
    }
  });

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <nav
        style={{
          display: 'flex',
          gap: 20,
          padding: '12px 20px',
          borderBottom: '1px solid #e0e0e0',
          alignItems: 'center',
          background: '#fafafa'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={logo}
            alt="Restaurant logo"
            style={{ height: 40, width: 40, objectFit: 'contain', borderRadius: 8 }}
          />
          <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('banquet_admin')}</div>
        </div>
        <Link
          to="/"
          style={{
            color: '#2196F3',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 200ms'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1976D2')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2196F3')}
        >
          {t('events')}
        </Link>
        <Link
          to="/admin/menu"
          style={{
            color: '#2196F3',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 200ms'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1976D2')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2196F3')}
        >
          {t('menu')}
        </Link>
        <Link
          to="/admin/table-categories"
          style={{
            color: '#2196F3',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 200ms'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1976D2')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2196F3')}
        >
          {t('tables')}
        </Link>
        <Link
          to="/admin/halls"
          style={{
            color: '#2196F3',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 200ms'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1976D2')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2196F3')}
        >
          {t('halls')}
        </Link>
        <Link
          to="/tablet"
          style={{
            color: '#2196F3',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 500,
            transition: 'color 200ms'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1976D2')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#2196F3')}
        >
          {t('tablet')}
        </Link>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div
            style={{
              fontSize: 13,
              color: '#666',
              padding: '6px 12px',
              background: '#fff',
              borderRadius: 4,
              border: '1px solid #e0e0e0'
            }}
          >
            👤 {username}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span>{t('language')}:</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              style={{ padding: '6px', borderRadius: 4, border: '1px solid #ccc' }}
            >
              {locales.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            style={{
              padding: '8px 16px',
              background: '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 500,
              cursor: logoutMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: logoutMutation.isPending ? 0.6 : 1,
              transition: 'opacity 200ms'
            }}
          >
            {logoutMutation.isPending ? t('logging_out') : t('logout')}
          </button>
        </div>
      </nav>
      <Outlet />
    </>
  );
};
