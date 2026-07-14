import { useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminEventsPage } from '../pages/AdminEventsPage';
import { AdminInvoicesPage } from '../pages/AdminInvoicesPage';
import { AdminNotificationsPage } from '../pages/AdminNotificationsPage';
import { AdminSettingsPage } from '../pages/AdminSettingsPage';
import { AdminArrangementAdminPage } from '../pages/AdminArrangementAdminPage';
import { AdminMenuPage } from '../pages/AdminMenuPage';
import { AdminSubcategoriesPage } from '../pages/AdminSubcategoriesPage';
import { AdminAdditionalPage } from '../pages/AdminAdditionalPage';
import { AdminTableCategoriesPage } from '../pages/AdminTableCategoriesPage';
import { AdminHallsPage } from '../pages/AdminHallsPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { ChiefAdminPage } from '../pages/ChiefAdminPage';
import { OwnerCabinetPage } from '../pages/OwnerCabinetPage';
import { ManagerPortalPage, ManagerRestaurantEventsPage } from '../pages/ManagerPortalPage';
import { ManagerRestaurantsPage } from '../pages/ManagerRestaurantsPage';
import { InvitationBuilderPage } from '../pages/InvitationBuilderPage';
import { GuestInvitationsPage } from '../pages/GuestInvitationsPage';
import { GuestInvitationBuilderPage } from '../pages/GuestInvitationBuilderPage';
import { InvitationSubdomainDispatcher } from '../pages/PublicGuestInvitationPage';
import { PublicInvitationPage } from '../pages/PublicInvitationPage';
import { CateringSite } from '../pages/CateringSite';
import { EmployeeEventsPage } from '../pages/EmployeeEventsPage';
import { EmployeeLayout } from './EmployeeLayout';
import { CalendarPage } from '../pages/CalendarPage';
import { DevicesPage } from '../pages/DevicesPage';
import { LoginPage } from '../pages/LoginPage';
import { TabletMenuPage } from '../pages/TabletMenuPage';
import { TabletSummaryPage } from '../pages/TabletSummaryPage';
import { AdminLayout } from './AdminLayout';
import { AdminReviewsPage } from '../pages/AdminReviewsPage';
import { AdminArrangementPage } from '../pages/AdminArrangementPage';
import { CateringAdminLayout } from './CateringAdminLayout';
import { RestaurantManagerLayout } from './RestaurantManagerLayout';
import { ExpenseLedgerPage } from '../pages/ExpenseLedgerPage';
import { AccountsPage } from '../pages/AccountsPage';
import { AdditionalExpensesPage } from '../pages/AdditionalExpensesPage';
import { TabletLayout } from './TabletLayout';
import { useAuthStore } from '../store/auth.store';
import type { AdminRole } from '../store/auth.store';
import { isRootDomain, isAdminSubdomain, isCabinetSubdomain, isManagerSubdomain, isRestaurantManagerSubdomain, isCateringAdminSubdomain, getInvitationSubdomainSlug, isEventSubdomain, getCateringSlug, toSubdomainSlug, buildAbsoluteUrl, buildSubdomainBase } from '../utils/subdomain';

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

  // Catering subdomain (<restaurant>.v-menu.uz) → public catering site
  const cateringSlug = getCateringSlug();
  if (cateringSlug) {
    return <CateringSite slug={cateringSlug} />;
  }

  // Flyer host (event.v-menu.uz or <restaurant>.event.v-menu.uz) → public flyer,
  // resolved by the path slug.
  if (isEventSubdomain()) {
    return (
      <Routes>
        <Route path="/:slug" element={<PublicInvitationPage />} />
        <Route path="/" element={<PublicInvitationPage />} />
        <Route path="*" element={<PublicInvitationPage />} />
      </Routes>
    );
  }

  // Invitation subdomain (<slug>.invitation.v-menu.uz) → public guest-invitation viewer.
  if (getInvitationSubdomainSlug()) {
    return (
      <Routes>
        <Route path="/:slug" element={<InvitationSubdomainDispatcher />} />
        <Route path="/" element={<InvitationSubdomainDispatcher />} />
        <Route path="*" element={<InvitationSubdomainDispatcher />} />
      </Routes>
    );
  }

  // Manager subdomain → MANAGER portal
  if (isManagerSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || (role !== 'MANAGER' && role !== 'CHIEF_ADMIN')) {
      if (window.location.pathname !== '/login') {
        window.location.href = buildAbsoluteUrl('/login');
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
        <Route path="/" element={<ManagerPortalPage />} />
        <Route path="/restaurants/:restaurantId" element={<ManagerRestaurantEventsPage />} />
        <Route path="/restaurants/:restaurantId/events/:eventId/invitation" element={<InvitationBuilderPage />} />
        <Route path="/flyers/new" element={<InvitationBuilderPage />} />
        <Route path="/flyers/:flyerId" element={<InvitationBuilderPage />} />
        <Route path="/invitations" element={<GuestInvitationsPage />} />
        <Route path="/invitations/new" element={<GuestInvitationBuilderPage />} />
        <Route path="/invitations/:id" element={<GuestInvitationBuilderPage />} />
        <Route path="/info" element={<ManagerRestaurantsPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Restaurant Manager subdomain → expense ledger + devices
  if (isRestaurantManagerSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || role !== 'RESTAURANT_MANAGER') {
      if (window.location.pathname !== '/login') {
        window.location.href = buildAbsoluteUrl('/login');
        return null;
      }
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
  }

  // On root domain, only /login, /tablet and /tablet/summary are accessible
  if (isRootDomain() && window.location.hostname !== 'localhost') {
    const { accessToken, role, restaurantName } = useAuthStore.getState();
    // CHIEF_ADMIN → admin.v-menu.uz
    if (accessToken && role === 'CHIEF_ADMIN' && window.location.pathname !== '/login') {
      window.location.href = buildSubdomainBase('admin');
      return null;
    }
    // MANAGER → manager.v-menu.uz
    if (accessToken && role === 'MANAGER' && window.location.pathname !== '/login') {
      window.location.href = buildSubdomainBase('manager');
      return null;
    }
    // RESTAURANT_MANAGER → rmanager.v-menu.uz
    if (accessToken && role === 'RESTAURANT_MANAGER' && window.location.pathname !== '/login') {
      window.location.href = buildSubdomainBase('rmanager');
      return null;
    }
    // CATERING_ADMIN → food-admin subdomain
    if (accessToken && role === 'CATERING_ADMIN' && restaurantName && window.location.pathname !== '/login') {
      const slug = `${toSubdomainSlug(restaurantName)}.food-admin`;
      window.location.href = buildSubdomainBase(slug);
      return null;
    }
    // Authenticated ADMIN/EMPLOYEE/KITCHEN on root domain → send to their banquet subdomain
    if (accessToken && restaurantName && window.location.pathname !== '/login') {
      const slug = toSubdomainSlug(restaurantName);
      window.location.href = buildSubdomainBase(`${slug}.banquet`);
      return null;
    }
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<TabletLayout />}>
          <Route path="/tablet" element={<TabletMenuPage />} />
          <Route path="/tablet/summary" element={<TabletSummaryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Cabinet subdomain → owner dashboard
  if (isCabinetSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || role !== 'OWNER') {
      if (window.location.pathname !== '/login') {
        window.location.href = buildAbsoluteUrl('/login');
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
        <Route path="/" element={<OwnerCabinetPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Admin subdomain → only the chief admin dashboard
  if (isAdminSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || role !== 'CHIEF_ADMIN') {
      if (window.location.pathname !== '/login') {
        window.location.href = buildAbsoluteUrl('/login');
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
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Food-admin subdomain (<slug>.food-admin.v-menu.uz) — requires CATERING_ADMIN auth.
  if (isCateringAdminSubdomain()) {
    const { accessToken, role: catRole } = useAuthStore.getState();
    if (!accessToken || catRole !== 'CATERING_ADMIN') {
      if (window.location.pathname !== '/login') {
        window.location.href = buildAbsoluteUrl('/login');
        return null;
      }
      return (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      );
    }
  }

  // RESTAURANT_MANAGER → expense ledger + devices, not tied to a restaurant.
  const role = useAuthStore((s) => s.role);
  if (role === 'RESTAURANT_MANAGER') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RestaurantManagerLayout />}>
          <Route path="/" element={<Navigate to="/accounts" replace />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/ledger" element={<ExpenseLedgerPage />} />
          <Route path="/additional" element={<AdditionalExpensesPage />} />
          <Route path="/devices" element={<DevicesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/accounts" replace />} />
      </Routes>
    );
  }

  // CATERING_ADMIN → restaurant admin dashboard limited to a few pages, in the
  // monochrome catering-site theme.
  if (role === 'CATERING_ADMIN') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<CateringAdminLayout />}>
          <Route path="/" element={<Navigate to="/admin/menu" replace />} />
          <Route path="/admin/menu" element={<AdminMenuPage />} />
          <Route path="/admin/subcategories" element={<AdminSubcategoriesPage />} />
          <Route path="/admin/arrangement" element={<AdminArrangementPage />} />
          <Route path="/admin/halls" element={<AdminHallsPage />} />
          <Route path="/admin/photos" element={<AdminPhotosPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/devices" element={<DevicesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/menu" replace />} />
      </Routes>
    );
  }

  // EMPLOYEE → simplified layout (with tablet); KITCHEN → same layout but no tablet access
  if (role === 'EMPLOYEE' || role === 'KITCHEN') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {role === 'EMPLOYEE' && (
          <Route element={<TabletLayout />}>
            <Route path="/tablet" element={<TabletMenuPage />} />
            <Route path="/tablet/summary" element={<TabletSummaryPage />} />
          </Route>
        )}
        <Route element={<EmployeeLayout />}>
          <Route path="/" element={<EmployeeEventsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/devices" element={<DevicesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<TabletLayout />}>
        <Route path="/tablet" element={<TabletMenuPage />} />
        <Route path="/tablet/summary" element={<TabletSummaryPage />} />
      </Route>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<AdminEventsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/admin/invoices" element={<AdminInvoicesPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/admin/menu" element={<AdminMenuPage />} />
        <Route path="/admin/subcategories" element={<AdminSubcategoriesPage />} />
        <Route path="/admin/additional" element={<AdminAdditionalPage />} />
        <Route path="/admin/table-categories" element={<AdminTableCategoriesPage />} />
        <Route path="/admin/halls" element={<AdminHallsPage />} />
        <Route path="/admin/photos" element={<AdminPhotosPage />} />
        <Route path="/admin/restaurants" element={<AdminRestaurantsPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/admin/arrangement" element={<AdminArrangementAdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
