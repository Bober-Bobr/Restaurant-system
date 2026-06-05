import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { eventService } from '../services/event.service';
import { restaurantService } from '../services/restaurant.service';
import { publicMenuService } from '../services/publicMenu.service';
import { invitationService } from '../services/invitation.service';
import { getPhotoUrl } from '../utils/photoUrl';
import networkingLogoSrc from '../assets/networking-logo.png';
import { PhotoUploadField } from '../components/PhotoUploadField';
const inputStyle = {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
};
const labelStyle = { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' };
function Section({ title, children }) {
    return (_jsxs("section", { className: "adm-card tablet-fade-up", style: { padding: 18 }, children: [_jsx("h2", { className: "adm-heading", style: { margin: '0 0 14px' }, children: title }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: children })] }));
}
function Field({ label, children }) {
    return (_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: labelStyle, children: label }), children] }));
}
function slugify(s) {
    return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 60) || 'invitation';
}
// ── Page ──────────────────────────────────────────────────────────────────
export const InvitationBuilderPage = () => {
    const { restaurantId = '', eventId = '' } = useParams();
    const accessToken = useAuthStore((s) => s.accessToken);
    const role = useAuthStore((s) => s.role);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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
    const event = (eventsQuery.data ?? []).find((e) => String(e.id) === String(eventId));
    const restaurant = restaurantsQuery.data?.find((r) => r.id === restaurantId);
    const existingQuery = useQuery({
        queryKey: ['invitation-by-event', eventId],
        queryFn: () => invitationService.byEvent(String(eventId), restaurantId),
        enabled: !!accessToken && !!eventId,
    });
    const [form, setForm] = useState({});
    const [savedFlash, setSavedFlash] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (existingQuery.data) {
            setForm(existingQuery.data);
        }
        else if (restaurant && event && Object.keys(form).length === 0) {
            // Initial template with sensible defaults from the event
            setForm({
                slug: slugify(`${restaurant.name}-${event.customerName}-${event.id}`),
                restaurantId,
                eventId: String(event.id),
                welcomeTitle: 'Добро пожаловать',
                welcomeSubtitle: 'Xush kelibsiz',
                welcomeMessage: `Добро пожаловать — вкус, тепло и гостеприимство ждут вас!`,
                countdownAt: event.eventDate,
                promoTitle: 'ОНЛАЙН ПРИГЛАСИТЕЛЬНОЕ',
                promoSubtitle: `Чтобы получить онлайн-пригласительное, напишите по телеграму и отправьте промокод`,
                telegramLabel: 'TELEGRAM',
                instagramLabel: 'INSTAGRAM',
                contactsTitle: 'НАШИ КОНТАКТЫ',
                menuItems: [],
                galleryPhotos: [],
                isPublished: true,
            });
        }
    }, [existingQuery.data, restaurant, event]); // eslint-disable-line react-hooks/exhaustive-deps
    const isEditing = !!existingQuery.data;
    const saveMutation = useMutation({
        mutationFn: async () => {
            if (isEditing && existingQuery.data) {
                return invitationService.update(existingQuery.data.id, form);
            }
            return invitationService.create({
                ...form,
                slug: form.slug ?? slugify(`${restaurant?.name}-${eventId}`),
                restaurantId,
                eventId: String(eventId),
            });
        },
        onSuccess: (inv) => {
            setError(null);
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1500);
            queryClient.setQueryData(['invitation-by-event', eventId], inv);
            queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
        },
        onError: (e) => {
            if (axios.isAxiosError(e)) {
                const body = e.response?.data;
                setError(body?.message ?? e.message);
            }
            else if (e instanceof Error)
                setError(e.message);
            else
                setError('Save failed');
        },
    });
    const deleteMutation = useMutation({
        mutationFn: () => existingQuery.data ? invitationService.remove(existingQuery.data.id) : Promise.resolve(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invitation-by-event', eventId] });
            queryClient.invalidateQueries({ queryKey: ['manager-invitations', restaurantId] });
            navigate(`/restaurants/${restaurantId}`);
        },
    });
    if (!accessToken)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (role !== 'MANAGER' && role !== 'CHIEF_ADMIN')
        return _jsx(Navigate, { to: "/login", replace: true });
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const restaurantSlug = useMemo(() => {
        if (!restaurant)
            return '';
        return restaurant.name.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 63);
    }, [restaurant]);
    const publicUrl = form.slug && restaurantSlug
        ? `https://${restaurantSlug}.invitation.v-menu.uz/${form.slug}`
        : '';
    // Toggle a restaurant menu item in the invitation. Numbering is auto-assigned.
    const toggleMenuItem = (selected) => {
        const items = [...(form.menuItems ?? [])];
        const idx = items.findIndex((it) => it.name === selected.name);
        if (idx >= 0) {
            items.splice(idx, 1);
        }
        else {
            items.push({ number: items.length + 1, name: selected.name, photoUrl: selected.photoUrl ?? null });
        }
        set('menuItems', items.map((it, i) => ({ ...it, number: i + 1 })));
    };
    const moveMenuItem = (index, dir) => {
        const items = [...(form.menuItems ?? [])];
        const next = index + dir;
        if (next < 0 || next >= items.length)
            return;
        [items[index], items[next]] = [items[next], items[index]];
        set('menuItems', items.map((it, i) => ({ ...it, number: i + 1 })));
    };
    const addGalleryPhoto = (url) => {
        if (!url.trim())
            return;
        set('galleryPhotos', [...(form.galleryPhotos ?? []), url.trim()]);
    };
    const removeGalleryPhoto = (index) => {
        const next = [...(form.galleryPhotos ?? [])];
        next.splice(index, 1);
        set('galleryPhotos', next);
    };
    return (_jsxs("div", { className: "adm-bg", children: [_jsx("nav", { style: {
                    position: 'sticky', top: 0, zIndex: 30,
                    background: 'rgba(15,23,42,0.78)',
                    backdropFilter: 'blur(18px)',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                }, children: _jsxs("div", { style: { maxWidth: 1280, margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }, children: [_jsxs(Link, { to: "/", style: { display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }, children: [_jsx("img", { src: networkingLogoSrc, alt: "", style: { height: 40, width: 'auto' } }), _jsxs("div", { children: [_jsx("p", { style: { margin: 0, fontSize: 14, fontWeight: 700, color: '#f8fafc' }, children: "Invitation Builder" }), _jsxs("p", { style: { margin: '2px 0 0', fontSize: 11, color: 'rgba(226,232,240,0.55)' }, children: [restaurant?.name ?? '...', " \u00B7 ", event?.customerName ?? '...'] })] })] }), _jsxs("div", { style: { marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [publicUrl && (_jsx("a", { href: publicUrl, target: "_blank", rel: "noreferrer", style: { fontSize: 12, color: '#c9a42c', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)' }, children: "Preview \u2197" })), isEditing && (_jsx("button", { type: "button", onClick: () => { if (confirm('Delete this invitation?'))
                                        deleteMutation.mutate(); }, className: "adm-btn-danger", style: { fontSize: 12 }, children: "Delete" })), _jsx("button", { type: "button", onClick: () => saveMutation.mutate(), disabled: saveMutation.isPending, className: "adm-btn-primary", style: { fontSize: 13 }, children: saveMutation.isPending ? 'Saving...' : (isEditing ? 'Save changes' : 'Create invitation') })] })] }) }), _jsxs("main", { className: "tablet-fade-in", style: { maxWidth: 1180, margin: '0 auto', padding: '28px 20px', position: 'relative', zIndex: 1, display: 'grid', gap: 16 }, children: [_jsx(Link, { to: `/restaurants/${restaurantId}`, style: { fontSize: 12, color: 'rgba(226,232,240,0.6)', textDecoration: 'none' }, children: "\u2190 Back to events" }), error && (_jsx("div", { style: { padding: 12, borderRadius: 10, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)', color: '#fca5a5', fontSize: 13 }, children: error })), savedFlash && (_jsx("div", { style: { padding: 12, borderRadius: 10, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80', fontSize: 13, fontWeight: 600 }, children: "\u2713 Saved" })), _jsxs(Section, { title: "Slug & link", children: [_jsx(Field, { label: "Slug", children: _jsx("input", { value: form.slug ?? '', onChange: (e) => set('slug', e.target.value), style: inputStyle, placeholder: "my-invitation" }) }), publicUrl && (_jsxs("p", { style: { margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }, children: ["Public URL: ", _jsx("code", { style: { color: '#c9a42c' }, children: publicUrl })] })), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#e2e8f0' }, children: [_jsx("input", { type: "checkbox", checked: form.isPublished ?? true, onChange: (e) => set('isPublished', e.target.checked) }), "Published (visible at the public URL)"] })] }), _jsxs(Section, { title: "Promo card (top hero)", children: [_jsx(Field, { label: "Title", children: _jsx("input", { value: form.promoTitle ?? '', onChange: (e) => set('promoTitle', e.target.value), style: inputStyle }) }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { value: form.promoSubtitle ?? '', onChange: (e) => set('promoSubtitle', e.target.value), style: inputStyle }) }), _jsx(Field, { label: "Promo code (badge)", children: _jsx("input", { value: form.promoCode ?? '', onChange: (e) => set('promoCode', e.target.value), style: inputStyle, placeholder: "#MARJON88" }) }), _jsx(PhotoUploadField, { label: "Promo image", value: form.promoImageUrl, onChange: (url) => set('promoImageUrl', url), restaurantId: restaurantId }), _jsx(Field, { label: "Alt promo code", children: _jsx("input", { value: form.promoCodeAlt ?? '', onChange: (e) => set('promoCodeAlt', e.target.value), style: inputStyle, placeholder: "#MARJON77" }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { value: form.promoDescription ?? '', onChange: (e) => set('promoDescription', e.target.value), style: { ...inputStyle, minHeight: 80, resize: 'vertical' } }) })] }), _jsxs(Section, { title: "Telegram CTA", children: [_jsx(Field, { label: "Telegram URL", children: _jsx("input", { value: form.telegramUrl ?? '', onChange: (e) => set('telegramUrl', e.target.value), style: inputStyle, placeholder: "https://t.me/marjon" }) }), _jsx(Field, { label: "Button label", children: _jsx("input", { value: form.telegramLabel ?? '', onChange: (e) => set('telegramLabel', e.target.value), style: inputStyle, placeholder: "TELEGRAM" }) })] }), _jsxs(Section, { title: "Welcome card", children: [_jsx(Field, { label: "Title", children: _jsx("input", { value: form.welcomeTitle ?? '', onChange: (e) => set('welcomeTitle', e.target.value), style: inputStyle, placeholder: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C" }) }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { value: form.welcomeSubtitle ?? '', onChange: (e) => set('welcomeSubtitle', e.target.value), style: inputStyle, placeholder: "Xush kelibsiz" }) }), _jsx(PhotoUploadField, { label: "Welcome image", value: form.welcomeImageUrl, onChange: (url) => set('welcomeImageUrl', url), restaurantId: restaurantId }), _jsx(Field, { label: "Message", children: _jsx("textarea", { value: form.welcomeMessage ?? '', onChange: (e) => set('welcomeMessage', e.target.value), style: { ...inputStyle, minHeight: 80, resize: 'vertical' } }) })] }), _jsxs(Section, { title: "Countdown", children: [_jsx(Field, { label: "Event date & time", children: _jsx("input", { type: "datetime-local", value: form.countdownAt ? form.countdownAt.slice(0, 16) : '', onChange: (e) => set('countdownAt', e.target.value ? new Date(e.target.value).toISOString() : null), style: inputStyle }) }), _jsx(Field, { label: "Label (e.g. weekday)", children: _jsx("input", { value: form.countdownLabel ?? '', onChange: (e) => set('countdownLabel', e.target.value), style: inputStyle, placeholder: "\u0421\u0420\u0415\u0414\u0410" }) })] }), _jsx(Section, { title: "Menu showcase", children: _jsx(MenuPicker, { restaurantId: restaurantId, selected: form.menuItems ?? [], onToggle: toggleMenuItem, onMove: moveMenuItem }) }), _jsx(Section, { title: "Photo gallery", children: _jsx(GalleryEditor, { photos: form.galleryPhotos ?? [], onAdd: addGalleryPhoto, onRemove: removeGalleryPhoto, restaurantId: restaurantId }) }), _jsxs(Section, { title: "Contacts", children: [_jsx(Field, { label: "Section title", children: _jsx("input", { value: form.contactsTitle ?? '', onChange: (e) => set('contactsTitle', e.target.value), style: inputStyle, placeholder: "\u041D\u0410\u0428\u0418 \u041A\u041E\u041D\u0422\u0410\u041A\u0422\u042B" }) }), _jsx(Field, { label: "Phone", children: _jsx("input", { value: form.phone ?? '', onChange: (e) => set('phone', e.target.value), style: inputStyle, placeholder: "+998 ..." }) }), _jsx(Field, { label: "Instagram URL", children: _jsx("input", { value: form.instagramUrl ?? '', onChange: (e) => set('instagramUrl', e.target.value), style: inputStyle, placeholder: "https://instagram.com/marjon_restaurant" }) }), _jsx(Field, { label: "Instagram label", children: _jsx("input", { value: form.instagramLabel ?? '', onChange: (e) => set('instagramLabel', e.target.value), style: inputStyle, placeholder: "@marjon_restaurant" }) }), _jsx(Field, { label: "vCard URL (Save contact)", children: _jsx("input", { value: form.contactVCardUrl ?? '', onChange: (e) => set('contactVCardUrl', e.target.value), style: inputStyle, placeholder: "/contacts/marjon.vcf" }) })] })] })] }));
};
function GalleryEditor({ photos, onAdd, onRemove, restaurantId }) {
    return (_jsxs(_Fragment, { children: [_jsx(PhotoUploadField, { value: null, onChange: (url) => { if (url)
                    onAdd(url); }, restaurantId: restaurantId, height: 110 }), photos.length > 0 && (_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }, children: photos.map((p, i) => (_jsxs("div", { style: { position: 'relative', borderRadius: 10, overflow: 'hidden', aspectRatio: '4 / 3', background: 'rgba(15,23,42,0.5)' }, children: [_jsx("img", { src: getPhotoUrl(p) ?? p, alt: "", style: { width: '100%', height: '100%', objectFit: 'cover' } }), _jsx("button", { type: "button", onClick: () => onRemove(i), style: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }, children: "\u00D7" })] }, i))) }))] }));
}
function MenuPicker({ restaurantId, selected, onToggle, onMove, }) {
    const menuQuery = useQuery({
        queryKey: ['public-menu', restaurantId],
        queryFn: () => publicMenuService.listActive(restaurantId),
        enabled: !!restaurantId,
    });
    const items = menuQuery.data ?? [];
    const isSelected = (name) => selected.some((s) => s.name === name);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 12 }, children: [selected.length > 0 && (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: [_jsxs("p", { style: { margin: 0, ...labelStyle }, children: ["Showcased (", selected.length, ")"] }), selected.map((it, i) => (_jsxs("div", { style: {
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 10,
                            background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.25)',
                        }, children: [_jsx("span", { style: { width: 26, height: 26, borderRadius: '50%', background: '#c9a42c', color: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }, children: it.number }), it.photoUrl
                                ? _jsx("img", { src: getPhotoUrl(it.photoUrl) ?? it.photoUrl, alt: "", style: { width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0 } })
                                : _jsx("div", { style: { width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 } }), _jsx("span", { style: { flex: 1, minWidth: 0, color: '#f8fafc', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: it.name }), _jsx("button", { type: "button", onClick: () => onMove(i, -1), disabled: i === 0, style: moveBtnStyle(i === 0), children: "\u2191" }), _jsx("button", { type: "button", onClick: () => onMove(i, 1), disabled: i === selected.length - 1, style: moveBtnStyle(i === selected.length - 1), children: "\u2193" }), _jsx("button", { type: "button", onClick: () => onToggle({ id: it.name, name: it.name, photoUrl: it.photoUrl }), style: { width: 26, height: 26, borderRadius: '50%', background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0 }, children: "\u00D7" })] }, `${it.name}-${i}`)))] })), _jsx("p", { style: { margin: 0, ...labelStyle }, children: "Available menu items" }), menuQuery.isLoading && _jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 12 }, children: "..." }), !menuQuery.isLoading && items.length === 0 && (_jsx("p", { style: { margin: 0, color: 'rgba(226,232,240,0.5)', fontSize: 12 }, children: "This restaurant has no active menu items yet." })), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }, children: items.map((m) => {
                    const picked = isSelected(m.name);
                    return (_jsxs("button", { type: "button", onClick: () => onToggle({ id: m.id, name: m.name, photoUrl: m.photoUrl }), style: {
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: 10,
                            background: picked ? 'rgba(34,197,94,0.12)' : 'rgba(15,23,42,0.5)',
                            border: `1px solid ${picked ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.08)'}`,
                            color: '#e2e8f0', textAlign: 'left', cursor: 'pointer',
                        }, children: [m.photoUrl
                                ? _jsx("img", { src: getPhotoUrl(m.photoUrl) ?? undefined, alt: "", style: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 } })
                                : _jsx("div", { style: { width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', flexShrink: 0 } }), _jsx("span", { style: { flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: m.name }), _jsx("span", { style: { color: picked ? '#4ade80' : '#c9a42c', fontWeight: 700, fontSize: 14, flexShrink: 0 }, children: picked ? '✓' : '+' })] }, m.id));
                }) }), _jsx("p", { style: { margin: 0, fontSize: 11, color: 'rgba(226,232,240,0.45)' }, children: "Showcase items come from this restaurant's menu. To add new items, open the restaurant's Menu page in the admin panel." })] }));
}
function moveBtnStyle(disabled) {
    return {
        width: 26, height: 26, borderRadius: 6,
        background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
        color: disabled ? 'rgba(226,232,240,0.3)' : 'rgba(226,232,240,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 12, lineHeight: 1, flexShrink: 0,
    };
}
