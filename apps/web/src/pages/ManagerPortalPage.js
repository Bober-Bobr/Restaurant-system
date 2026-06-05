import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { restaurantService } from '../services/restaurant.service';
import { eventService } from '../services/event.service';
import { invitationService } from '../services/invitation.service';
import { useAuthStore } from '../store/auth.store';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';
function ManagerNav({ pageTitle, currentRestaurantName }) {
    const username = useAuthStore((s) => s.username);
    const logout = useAuthStore((s) => s.logout);
    const logoutMutation = useMutation({
        mutationFn: () => authService.logout(),
        onSettled: () => {
            logout();
            window.location.href = 'https://v-menu.uz/login';
        },
    });
    return (_jsx("nav", { style: {
            position: 'sticky', top: 0, zIndex: 30,
            background: 'rgba(15,23,42,0.78)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
        }, children: _jsxs("div", { style: { maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }, children: [_jsxs(Link, { to: "/", style: { display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }, children: [_jsx("img", { src: networkingLogoSrc, alt: "", style: { height: 40, width: 'auto' } }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }, children: pageTitle ?? 'Manager Portal' }), _jsxs("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)', display: 'flex', alignItems: 'center', gap: 6 }, children: [username, _jsx("span", { className: "adm-badge", style: { background: 'rgba(139,92,246,0.18)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }, children: "MANAGER" })] })] })] }), currentRestaurantName && (_jsx("span", { className: "adm-badge", style: { background: 'rgba(201,164,44,0.15)', color: '#c9a42c', border: '1px solid rgba(201,164,44,0.3)' }, children: currentRestaurantName })), _jsxs("button", { type: "button", className: "adm-btn-danger", onClick: () => logoutMutation.mutate(), disabled: logoutMutation.isPending, style: { marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), _jsx("polyline", { points: "16 17 21 12 16 7" }), _jsx("line", { x1: "21", y1: "12", x2: "9", y2: "12" })] }), logoutMutation.isPending ? 'Logging out...' : 'Log out'] })] }) }));
}
// ── /  (restaurant list) ──────────────────────────────────────────────────
export const ManagerPortalPage = () => {
    const role = useAuthStore((s) => s.role);
    const accessToken = useAuthStore((s) => s.accessToken);
    const navigate = useNavigate();
    const restaurantsQuery = useQuery({
        queryKey: ['manager-restaurants'],
        queryFn: () => restaurantService.list(),
        enabled: !!accessToken,
    });
    if (!accessToken)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN')
        return _jsx(Navigate, { to: "/login", replace: true });
    const restaurants = restaurantsQuery.data ?? [];
    return (_jsxs("div", { className: "adm-bg", children: [_jsx(ManagerNav, {}), _jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsx("h1", { className: "adm-title", style: { marginBottom: 20 }, children: "Restaurants" }), restaurantsQuery.isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: "..." }), restaurants.length === 0 && !restaurantsQuery.isLoading && (_jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: "No restaurants yet." })), _jsx("div", { style: { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }, children: restaurants.map((r) => (_jsxs("button", { type: "button", onClick: () => navigate(`/restaurants/${r.id}`), className: "adm-card adm-card-hover tablet-fade-up", style: {
                                padding: 18,
                                display: 'flex', alignItems: 'center', gap: 14,
                                textAlign: 'left', cursor: 'pointer',
                                color: '#e2e8f0',
                            }, children: [r.logoUrl
                                    ? _jsx("img", { src: getPhotoUrl(r.logoUrl) ?? undefined, alt: r.name, style: { height: 56, width: 'auto', maxWidth: 96, objectFit: 'contain', flexShrink: 0 } })
                                    : _jsx("div", { style: { width: 56, height: 56, borderRadius: 12, background: 'rgba(201,164,44,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, children: _jsx("span", { style: { fontSize: 22, fontWeight: 700, color: '#c9a42c' }, children: r.name.charAt(0) }) }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { margin: 0, fontSize: 16, fontWeight: 700, color: '#f8fafc' }, children: r.name }), r.address && (_jsx("p", { style: { margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.55)' }, children: r.address }))] }), _jsx("span", { style: { color: '#c9a42c', fontSize: 22, flexShrink: 0 }, children: "\u203A" })] }, r.id))) })] })] }));
};
// ── /restaurants/:restaurantId  (events list) ─────────────────────────────
export const ManagerRestaurantEventsPage = () => {
    const { restaurantId = '' } = useParams();
    const accessToken = useAuthStore((s) => s.accessToken);
    const role = useAuthStore((s) => s.role);
    const navigate = useNavigate();
    const [status, setStatus] = useState('ALL');
    const restaurantsQuery = useQuery({
        queryKey: ['manager-restaurants'],
        queryFn: () => restaurantService.list(),
        enabled: !!accessToken,
    });
    const eventsQuery = useQuery({
        queryKey: ['manager-events', restaurantId],
        queryFn: () => eventService.list({ restaurantId }),
        enabled: !!accessToken && !!restaurantId,
    });
    const invitationsQuery = useQuery({
        queryKey: ['manager-invitations', restaurantId],
        queryFn: () => invitationService.listByRestaurant(restaurantId),
        enabled: !!accessToken && !!restaurantId,
    });
    if (!accessToken)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN')
        return _jsx(Navigate, { to: "/login", replace: true });
    const restaurant = restaurantsQuery.data?.find((r) => r.id === restaurantId);
    const events = eventsQuery.data ?? [];
    const invitations = invitationsQuery.data ?? [];
    const eventHasInvitation = (eventId) => invitations.some((i) => i.eventId === eventId);
    const filtered = status === 'ALL' ? events : events.filter((e) => e.status === status);
    return (_jsxs("div", { className: "adm-bg", children: [_jsx(ManagerNav, { pageTitle: "Restaurant events", currentRestaurantName: restaurant?.name ?? null }), _jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }, children: [_jsxs("div", { children: [_jsx(Link, { to: "/", style: { fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }, children: "\u2190 All restaurants" }), _jsxs("h1", { className: "adm-title", style: { margin: '6px 0 0' }, children: [restaurant?.name ?? 'Restaurant', " \u2014 events"] })] }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: ['ALL', 'DRAFT', 'CONFIRMED', 'CANCELLED'].map((s) => (_jsx("button", { type: "button", onClick: () => setStatus(s), style: {
                                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                        border: '1px solid',
                                        borderColor: status === s ? 'rgba(201,164,44,0.5)' : 'rgba(255,255,255,0.1)',
                                        background: status === s ? 'rgba(201,164,44,0.15)' : 'rgba(255,255,255,0.04)',
                                        color: status === s ? '#c9a42c' : 'rgba(226,232,240,0.65)',
                                        cursor: 'pointer',
                                    }, children: s }, s))) })] }), eventsQuery.isLoading && _jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: "..." }), !eventsQuery.isLoading && filtered.length === 0 && (_jsx("p", { style: { color: 'rgba(226,232,240,0.5)' }, children: "No events." })), _jsx("div", { style: { display: 'grid', gap: 10 }, children: filtered.map((e) => {
                            const hasInv = eventHasInvitation(e.id);
                            return (_jsxs("button", { type: "button", onClick: () => navigate(`/restaurants/${restaurantId}/events/${e.id}/invitation`), className: "adm-card adm-card-hover", style: {
                                    padding: '14px 16px',
                                    display: 'flex', alignItems: 'center', gap: 14,
                                    textAlign: 'left', cursor: 'pointer', color: '#e2e8f0',
                                    flexWrap: 'wrap',
                                }, children: [_jsxs("div", { style: { flex: 1, minWidth: 200 }, children: [_jsx("p", { style: { margin: 0, fontSize: 15, fontWeight: 700, color: '#f8fafc' }, children: e.customerName }), _jsxs("p", { style: { margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.55)' }, children: [new Date(e.eventDate).toLocaleString(), e.eventType ? ` · ${e.eventType}` : '', e.guestCount ? ` · ${e.guestCount} guests` : ''] })] }), _jsx("span", { className: "adm-badge", style: {
                                            background: e.status === 'CONFIRMED' ? 'rgba(34,197,94,0.15)' : e.status === 'CANCELLED' ? 'rgba(220,38,38,0.15)' : 'rgba(201,164,44,0.15)',
                                            color: e.status === 'CONFIRMED' ? '#4ade80' : e.status === 'CANCELLED' ? '#fca5a5' : '#c9a42c',
                                            border: `1px solid ${e.status === 'CONFIRMED' ? 'rgba(34,197,94,0.35)' : e.status === 'CANCELLED' ? 'rgba(220,38,38,0.35)' : 'rgba(201,164,44,0.3)'}`,
                                        }, children: e.status }), hasInv && (_jsx("span", { className: "adm-badge", style: { background: 'rgba(139,92,246,0.15)', color: '#c4b5fd', border: '1px solid rgba(139,92,246,0.3)' }, children: "Invitation \u2713" })), _jsx("span", { style: { color: '#c9a42c', fontSize: 18 }, children: "\u203A" })] }, e.id));
                        }) })] })] }));
};
