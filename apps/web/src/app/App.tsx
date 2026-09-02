import { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import { AdminExtraServicesPage } from '../pages/AdminExtraServicesPage';
import { AdminPhotosPage } from '../pages/AdminPhotosPage';
import { AdminRestaurantsPage } from '../pages/AdminRestaurantsPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { ChiefAdminPage } from '../pages/ChiefAdminPage';
import { OwnerCabinetPage } from '../pages/OwnerCabinetPage';
import { ManagerPortalPage } from '../pages/ManagerPortalPage';
import { ManagerRestaurantsPage } from '../pages/ManagerRestaurantsPage';
import { InvitationBuilderPage } from '../pages/InvitationBuilderPage';
import { FlyerRequestsPage } from '../pages/FlyerRequestsPage';
import { TemplateEditorPage } from '../pages/TemplateEditorPage';
import { InvitationSubdomainDispatcher } from '../pages/PublicGuestInvitationPage';
import { PublicInvitationPage } from '../pages/PublicInvitationPage';
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
import { isConnectHost, isNfcBuilderHost, getPlaqueSlug, isRootDomain, isAdminSubdomain, isCabinetSubdomain, isManagerSubdomain, isRestaurantManagerSubdomain, isPerformerSubdomain, isBanquetHost, getBanquetSlug, isFoodAdminHost, isFoodSiteHost, getFoodSiteSlug, getInvitationSubdomainSlug, isEventSubdomain, getCateringSlug, toSubdomainSlug, buildAbsoluteUrl, buildSubdomainBase, buildBanquetUrl, buildFoodAdminUrl, isInviteRootDomain, getInviteSiteSlug } from '../utils/subdomain';
import { applyAppTitle } from '../utils/applyAppTitle';
import { publicRestaurantService } from '../services/publicRestaurant.service';
import { AdditionalServicesBySlug, AdditionalServicesPage } from '../pages/AdditionalServicesPage';
import { PerformerLayout } from './PerformerLayout';
import { FoodEmployeeLayout } from './FoodEmployeeLayout';
import { FoodEmployeeOrdersPage } from '../pages/FoodEmployeeOrdersPage';
import { FoodEmployeeStatsPage } from '../pages/FoodEmployeeStatsPage';
import { PerformerProfilePage } from '../pages/PerformerProfilePage';
import { PerformerCalendarPage } from '../pages/PerformerCalendarPage';
import { PerformerBookingsPage } from '../pages/PerformerBookingsPage';
import { VConnectLoginPage } from '../vconnect/VConnectLoginPage';
import { PublicPlaquePage } from '../vconnect/PublicPlaquePage';
import '../vconnect/vconnect.css';

// ── Code splitting ───────────────────────────────────────────────────────────
// One SPA serves five products, and the host decides which one a visitor gets —
// so a visitor only ever runs ONE of these. Imported eagerly they all landed in
// the entry chunk, which is how tapping an NFC tag came to download the twelve
// rich invitation templates: `vinvite/templates` alone is ~1.1 MB of inlined
// HTML, and nothing outside `vinvite/` references it.
//
// These are the product roots, not individual routes: each is the single
// component a host resolves to, so splitting here costs at most one extra
// request on a path that was already fetching its own data.
//
// `PublicPlaquePage` is deliberately NOT split. It is the page behind an NFC
// tag — the one load that has to be fast on a cold phone — so it stays in the
// entry chunk rather than paying a second round trip to start rendering.
const VInviteApp = lazy(() => import('../vinvite/VInviteApp').then((m) => ({ default: m.VInviteApp })));
const PublicVInvitePage = lazy(() => import('../vinvite/PublicVInvitePage').then((m) => ({ default: m.PublicVInvitePage })));
const NfcApp = lazy(() => import('../vconnect/NfcApp').then((m) => ({ default: m.NfcApp })));
const FoodSiteApp = lazy(() => import('../foodsite/FoodSiteApp').then((m) => ({ default: m.FoodSiteApp })));
const CateringSite = lazy(() => import('../pages/CateringSite').then((m) => ({ default: m.CateringSite })));

// Nothing branded: each product paints its own background within a frame or two
// of this appearing, and a themed splash here would be the WRONG brand for four
// of the five.
function Chunk({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>{children}</Suspense>;
}

export const App = () => {
  const handledRef = useRef(false);

  // ── The browser tab ───────────────────────────────────────────────────────
  // main.tsx applies this once before the first render; here it is re-applied
  // whenever the session changes, so signing in retitles the tab without a
  // reload. Both go through applyAppTitle rather than each layout setting its
  // own title: a child's effect runs BEFORE its parent's, so a title written
  // inside a layout would simply lose to this one a moment later.
  const role = useAuthStore((state) => state.role);
  const authRestaurantName = useAuthStore((state) => state.restaurantName);
  useEffect(() => {
    applyAppTitle();
  }, [role, authRestaurantName]);

  // ── v-invite.uz: the standalone invitation-builder product ──
  // <name>.v-invite.uz → a published invitation site; the root host → the app.
  const inviteSiteSlug = getInviteSiteSlug();
  if (inviteSiteSlug) {
    return <Chunk><PublicVInvitePage slug={inviteSiteSlug} /></Chunk>;
  }
  if (isInviteRootDomain()) {
    return <Chunk><VInviteApp /></Chunk>;
  }

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

  // ── v-connect.uz: the NFC-plaque product ──
  // nfc.v-connect.uz → the builder (it consumes the _at/_rt handoff above);
  // v-connect.uz/login → sign-in; v-connect.uz/<slug> → a published plaque.
  if (isConnectHost()) {
    if (isNfcBuilderHost()) return <Chunk><NfcApp /></Chunk>;
    const plaqueSlug = getPlaqueSlug();
    if (plaqueSlug) {
      return <PublicPlaquePage slug={plaqueSlug} />;
    }
    // Bare v-connect.uz (or /login) → the sign-in page.
    return (
      <Routes>
        <Route path="/login" element={<VConnectLoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // test.v-menu.uz/<slug> → the next-generation food-service site (Phase 1),
  // running beside the live catering site below so it can be reviewed without
  // touching production. The bare host is handled inside FoodSiteApp rather than
  // falling through — otherwise it would reach the RoleRoutes fallback and show
  // an admin shell to a stranger.
  if (isFoodSiteHost()) {
    return <Chunk><FoodSiteApp slug={getFoodSiteSlug()} /></Chunk>;
  }

  // Catering site (v-menu.uz/<slug>) → the live public catering site
  const cateringSlug = getCateringSlug();
  if (cateringSlug) {
    return <Chunk><CateringSite slug={cateringSlug} /></Chunk>;
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
        <Route path="/flyers/new" element={<InvitationBuilderPage />} />
        <Route path="/flyers/:flyerId" element={<InvitationBuilderPage />} />
        <Route path="/flyers/:flyerId/requests" element={<FlyerRequestsPage />} />
        <Route path="/templates/:templateId" element={<TemplateEditorPage />} />
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

  // Performer subdomain → the performer workspace, shared with hosts: the two
  // roles get the same profile, calendar and booking inbox, so they get the
  // same app. Which one you are only changes the labels.
  if (isPerformerSubdomain()) {
    const { accessToken, role } = useAuthStore.getState();
    if (!accessToken || (role !== 'PERFORMER' && role !== 'HOST')) {
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
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PerformerLayout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<PerformerProfilePage />} />
          <Route path="/calendar" element={<PerformerCalendarPage />} />
          <Route path="/bookings" element={<PerformerBookingsPage />} />
          <Route path="/devices" element={<DevicesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/profile" replace />} />
      </Routes>
    );
  }

  // On root domain, only /login and the (signed-in) tablet kiosk are accessible
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
    // PERFORMER / HOST → performer.v-menu.uz
    if (accessToken && (role === 'PERFORMER' || role === 'HOST') && window.location.pathname !== '/login') {
      window.location.href = buildSubdomainBase('performer');
      return null;
    }
    // RESTAURANT_MANAGER → rmanager.v-menu.uz
    if (accessToken && role === 'RESTAURANT_MANAGER' && window.location.pathname !== '/login') {
      window.location.href = buildSubdomainBase('rmanager');
      return null;
    }
    // CATERING_ADMIN and CATERING_EMPLOYEE → food-admin.v-menu.uz/<slug>
    if (accessToken && (role === 'CATERING_ADMIN' || role === 'CATERING_EMPLOYEE') && restaurantName && window.location.pathname !== '/login') {
      window.location.href = buildFoodAdminUrl(toSubdomainSlug(restaurantName));
      return null;
    }
    // Authenticated ADMIN/EMPLOYEE/KITCHEN on root domain → send to banquet.v-menu.uz/<slug>
    if (accessToken && restaurantName && window.location.pathname !== '/login') {
      window.location.href = buildBanquetUrl(toSubdomainSlug(restaurantName));
      return null;
    }
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* The kiosk needs a signed-in device. There used to be an anonymous
            "view menu" mode reachable from the login page, and these routes
            were what it ran on; removing only the button would have left the
            mode alive to anyone who typed the URL. Staff reach the kiosk from
            banquet.v-menu.uz, where these same routes sit inside the
            authenticated tree. Without a token everything falls through to
            /login below. */}
        {accessToken && (
          <Route element={<TabletLayout />}>
            <Route path="/tablet" element={<TabletMenuPage />} />
            <Route path="/tablet/summary" element={<TabletSummaryPage />} />
            <Route path="/tablet/additional-services" element={<AdditionalServicesPage />} />
          </Route>
        )}
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

  // Food-admin host (food-admin.v-menu.uz/<slug>) — requires CATERING_ADMIN auth.
  if (isFoodAdminHost()) {
    const { accessToken, role: catRole } = useAuthStore.getState();
    // Food employees share this host with the Food Admin — the food-service
    // product has one admin host, and adding a second would mean another DNS
    // record, nginx block and certificate for two screens.
    if (!accessToken || (catRole !== 'CATERING_ADMIN' && catRole !== 'CATERING_EMPLOYEE')) {
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

  // banquet.v-menu.uz/<slug> — a restaurant without the banquet module gets the
  // Additional Services page here instead of the admin panel or a login screen
  // it could never get past. Every host check above is false on this host, so
  // the gate wraps exactly the role-based routing below.
  if (isBanquetHost()) {
    return <BanquetHostGate />;
  }

  return <RoleRoutes />;
};

// Resolves the restaurant from the URL slug to decide whether the banquet admin
// app is available at all. Renders nothing until the answer is known — flashing
// a login screen and then replacing it would be worse than a blank moment.
const BanquetHostGate = () => {
  const slug = getBanquetSlug();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!slug) { setAllowed(true); return; }
    let cancelled = false;
    publicRestaurantService.modulesBySlug(slug).then(
      (r) => { if (!cancelled) setAllowed(r.moduleBanquet); },
      // Unknown slug or the API is unreachable: fall back to the normal app
      // rather than accusing a paying restaurant of not having the module.
      () => { if (!cancelled) setAllowed(true); },
    );
    return () => { cancelled = true; };
  }, [slug]);

  if (allowed === null) return null;
  if (!allowed && slug) return <AdditionalServicesBySlug slug={slug} />;
  return <RoleRoutes />;
};

// Role-based routing — the tail of the host waterfall above.
const RoleRoutes = () => {
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

  // CATERING_EMPLOYEE (Food Employee) → the food-service floor: take orders by
  // code, look after them, close them. Deliberately only two routes; everything
  // else redirects to Orders. The banquet EMPLOYEE role below is untouched.
  if (role === 'CATERING_EMPLOYEE') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<FoodEmployeeLayout />}>
          <Route path="/orders" element={<FoodEmployeeOrdersPage />} />
          <Route path="/stats" element={<FoodEmployeeStatsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/orders" replace />} />
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
            <Route path="/tablet/additional-services" element={<AdditionalServicesPage />} />
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
            <Route path="/tablet/additional-services" element={<AdditionalServicesPage />} />
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
        <Route path="/admin/extra-services" element={<AdminExtraServicesPage />} />
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
