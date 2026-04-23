import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { Locale, locales, translate } from '../utils/translate';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { getPhotoUrl } from '../utils/photoUrl';


export const AdminLayout = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const authRestaurantId = useAuthStore((state) => state.restaurantId);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => translate(key, locale, params);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken
  });

  const restaurantLogoSrc = getPhotoUrl(restaurants[0]?.logoUrl);
  const restaurantName = restaurants[0]?.name;
  const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';

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
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {restaurantLogoSrc && (
              <img src={restaurantLogoSrc} alt={restaurantName ?? 'Restaurant logo'} className="h-11 w-11 rounded-2xl object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{restaurantName ?? t('banquet_admin')}</p>
              <p className="text-xs text-slate-500">
                {username}
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: '#2563eb', color: '#fff', fontSize: 10, fontWeight: 600, verticalAlign: 'middle' }}>
                  Admin
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700">
            <Link className="transition hover:text-slate-900" to="/">{t('events')}</Link>
            <Link className="transition hover:text-slate-900" to="/admin/menu">{t('menu')}</Link>
            <Link className="transition hover:text-slate-900" to="/admin/table-categories">{t('tables')}</Link>
            <Link className="transition hover:text-slate-900" to="/admin/halls">{t('halls')}</Link>
            <Link className="transition hover:text-slate-900" to="/admin/photos">{t('photos')}</Link>
            <Link className="rounded-full border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50" to={`/tablet?restaurantId=${tabletRestaurantId}`}>
              {t('tablet')}
            </Link>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Select value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className="w-32" aria-label="Language">
              {locales.map((localeOption) => (
                <option key={localeOption} value={localeOption}>
                  {t(localeOption === 'en' ? 'english' : localeOption === 'ru' ? 'russian' : 'uzbek')}
                </option>
              ))}
            </Select>
            <Button variant="destructive" size="sm" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
              {logoutMutation.isPending ? t('logging_out') : t('logout')}
            </Button>
          </div>
        </div>
      </nav>
      <Outlet />
    </>
  );
};
