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
import networkingLogoSrc from '../assets/networking-logo.png';

export const EmployeeLayout = () => {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const username = useAuthStore((state) => state.username);
  const role = useAuthStore((state) => state.role);
  const authRestaurantId = useAuthStore((state) => state.restaurantId);
  const logout = useAuthStore((state) => state.logout);
  const { locale, setLocale } = useAdminStore();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);

  const { data: restaurants = [] } = useQuery({
    queryKey: ['restaurants'],
    queryFn: () => restaurantService.list(),
    enabled: !!accessToken,
  });

  const effectiveLogoUrl = restaurants[0]?.logoUrl ?? restaurants[0]?.company?.logoUrl ?? null;
  const restaurantLogoSrc = getPhotoUrl(effectiveLogoUrl);
  const restaurantName = restaurants[0]?.name;
  const tabletRestaurantId = authRestaurantId ?? restaurants[0]?.id ?? '';

  const logoutMutation = useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      logout();
      window.location.href = 'https://v-menu.uz/login';
    },
  });

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Wrong role lands here? Send them to the right place.
  if (role !== 'EMPLOYEE' && role !== 'KITCHEN') {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <>
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {restaurantLogoSrc ? (
              <img src={restaurantLogoSrc} alt={restaurantName ?? 'Restaurant logo'} className="h-11 w-11 rounded-2xl object-cover" />
            ) : (
              <img src={networkingLogoSrc} alt="Networking" className="h-9 w-9 object-contain" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{restaurantName ?? t('banquet_admin')}</p>
              <p className="text-xs text-slate-500">
                {username}
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 4, background: role === 'KITCHEN' ? '#ea580c' : '#16a34a', color: '#fff', fontSize: 10, fontWeight: 600, verticalAlign: 'middle' }}>
                  {t(role === 'KITCHEN' ? 'kitchen_role' : 'employee_role')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700">
            <Link className="transition hover:text-slate-900" to="/">{t('events')}</Link>
            {role !== 'KITCHEN' && (
              <Link className="rounded-full border border-slate-200 px-3 py-2 transition hover:border-slate-300 hover:bg-slate-50" to={`/tablet?restaurantId=${tabletRestaurantId}`}>
                {t('tablet')}
              </Link>
            )}
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
