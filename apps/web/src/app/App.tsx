import { useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { ChiefAdminPage } from '../pages/ChiefAdminPage';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';
import { isRootDomain, isAdminSubdomain, toSubdomainSlug } from '../utils/subdomain';

export const App = () => {
  const handledRef = useRef(false);

  if (!handledRef.current) {
    handledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const at = params.get('_at');
    const rt = params.get('_rt');
    const u = params.get('_u');
    const r = params.get('_r') as AdminRole | null;
    if (at && rt && u && r) {
      const rid = params.get('_rid');
      const rn = params.get('_rn');
      const exp = Number(params.get('_exp') || '0');
      useAuthStore.getState().setAuth(at, rt, u, exp || 15 * 60 * 1000, r, rid || null, rn || null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  // On root domain, only /login, /tablet and /tablet/summary are accessible
  if (isRootDomain() && window.location.hostname !== 'localhost') {
    const { accessToken, role, restaurantName } = useAuthStore.getState();
    // CHIEF_ADMIN → admin.v-menu.uz
    if (accessToken && role === 'CHIEF_ADMIN' && window.location.pathname !== '/login') {
      window.location.href = 'https://admin.v-menu.uz/';
      return null;
    }
    // Authenticated user on root domain → send to their restaurant subdomain
    if (accessToken && restaurantName && window.location.pathname !== '/login') {
      const slug = toSubdomainSlug(restaurantName);
      window.location.href = `https://${slug}.v-menu.uz/`;
      return null;
    }
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tablet" element={<TabletMenuPage />} />
        <Route path="/tablet/summary" element={<TabletSummaryPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Admin subdomain → only the chief admin dashboard
  if (isAdminSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || role !== 'CHIEF_ADMIN') {
      if (window.location.pathname !== '/login') {
        window.location.href = 'https://v-menu.uz/login';
        return null;
      }
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
    return (
      <Routes>
        <Route path="/" element={<ChiefAdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/tablet" element={<TabletMenuPage />} />
      <Route path="/tablet/summary" element={<TabletSummaryPage />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminEventsPage />} />
        <Route path="/admin/menu" element={<AdminMenuPage />} />
        <Route path="/admin/table-categories" element={<AdminTableCategoriesPage />} />
        <Route path="/admin/halls" element={<AdminHallsPage />} />
        <Route path="/admin/photos" element={<AdminPhotosPage />} />
        <Route path="/admin/restaurants" element={<AdminRestaurantsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
