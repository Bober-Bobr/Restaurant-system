import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';

export const App = () => {
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const at = params.get('_at');
    const rt = params.get('_rt');
    const u = params.get('_u');
    const r = params.get('_r') as AdminRole | null;
    const rid = params.get('_rid');
    const rn = params.get('_rn');
    const exp = Number(params.get('_exp') || '0');
    if (at && rt && u && r) {
      setAuth(at, rt, u, exp || 15 * 60 * 1000, r, rid || null, rn || null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [setAuth]);

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
