import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { invitationService } from '../services/invitation.service';
import { getPhotoUrl } from '../utils/photoUrl';
const ACCENT = '#c9a42c';
const PAGE_BG = `
  radial-gradient(circle at 20% 0%, rgba(212,175,55,0.18) 0%, transparent 40%),
  radial-gradient(circle at 80% 100%, rgba(212,175,55,0.14) 0%, transparent 50%),
  #fafaf7
`;
const PAPER_BG = '#fdfcf8';
const TEXT = '#1a1a1a';
function useCountdown(target) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, []);
    if (!target)
        return null;
    const diff = Math.max(0, new Date(target).getTime() - now);
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff / (60 * 60 * 1000)) % 24);
    const minutes = Math.floor((diff / (60 * 1000)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    return { days, hours, minutes, seconds };
}
function Block({ children, padded = true }) {
    return (_jsx("div", { style: {
            background: PAPER_BG,
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: padded ? 20 : 0,
            overflow: 'hidden',
        }, children: children }));
}
export const PublicInvitationPage = () => {
    const { slug = '' } = useParams();
    const { data: invitation, isLoading, isError } = useQuery({
        queryKey: ['public-invitation', slug],
        queryFn: () => invitationService.publicBySlug(slug),
        enabled: !!slug,
    });
    const cd = useCountdown(invitation?.countdownAt);
    if (isLoading) {
        return _jsx("main", { style: { minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }, children: "..." });
    }
    if (isError || !invitation) {
        return _jsx("main", { style: { minHeight: '100vh', background: PAGE_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, fontFamily: 'serif' }, children: "Invitation not found" });
    }
    const promoImg = invitation.promoImageUrl ? (getPhotoUrl(invitation.promoImageUrl) ?? invitation.promoImageUrl) : null;
    const welcomeImg = invitation.welcomeImageUrl ? (getPhotoUrl(invitation.welcomeImageUrl) ?? invitation.welcomeImageUrl) : null;
    const restaurantLogo = invitation.restaurant?.logoUrl ? (getPhotoUrl(invitation.restaurant.logoUrl) ?? invitation.restaurant.logoUrl) : null;
    return (_jsx("main", { style: {
            minHeight: '100vh',
            background: PAGE_BG,
            color: TEXT,
            fontFamily: '"Playfair Display", Georgia, serif',
            padding: '20px 16px',
            display: 'flex', justifyContent: 'center',
        }, children: _jsxs("div", { style: { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsxs(Block, { padded: false, children: [_jsxs("div", { style: { position: 'relative' }, children: [promoImg ? (_jsx("img", { src: promoImg, alt: "", style: { width: '100%', height: 'auto', display: 'block' } })) : (_jsx("div", { style: { aspectRatio: '4 / 3', background: `linear-gradient(135deg, ${ACCENT}40 0%, #b88e26 100%)`, position: 'relative' }, children: _jsx("span", { style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }, children: invitation.promoTitle ?? 'Online invitation' }) })), invitation.promoCode && (_jsx("div", { style: {
                                        position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
                                        background: ACCENT, color: '#0f0f0f',
                                        padding: '6px 18px', borderRadius: 999,
                                        fontWeight: 800, fontSize: 14, letterSpacing: '0.05em',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    }, children: invitation.promoCode })), _jsx("span", { style: {
                                        position: 'absolute', top: 10, left: -2,
                                        background: '#000', color: ACCENT,
                                        padding: '4px 12px', fontWeight: 800, fontSize: 11, letterSpacing: '0.15em',
                                        transform: 'rotate(-12deg)',
                                    }, children: "FREE" })] }), invitation.promoSubtitle && (_jsx("p", { style: { margin: 0, padding: '12px 16px', fontSize: 12, textAlign: 'center', fontWeight: 600, color: TEXT, fontFamily: 'system-ui, sans-serif' }, children: invitation.promoSubtitle }))] }), (invitation.promoCodeAlt || invitation.promoDescription) && (_jsxs(Block, { children: [invitation.promoCodeAlt && (_jsx("h3", { style: { margin: '0 0 8px', fontSize: 18, fontWeight: 800, color: TEXT, fontFamily: 'system-ui, sans-serif' }, children: invitation.promoCodeAlt })), invitation.promoDescription && (_jsx("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.5, color: '#444', fontFamily: 'system-ui, sans-serif' }, children: invitation.promoDescription }))] })), invitation.telegramUrl && (_jsxs("a", { href: invitation.telegramUrl, target: "_blank", rel: "noreferrer", style: {
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        padding: '14px 16px',
                        background: '#2aabee',
                        borderRadius: 14,
                        color: '#fff',
                        textDecoration: 'none',
                        fontWeight: 800, fontSize: 15, letterSpacing: '0.1em',
                        fontFamily: 'system-ui, sans-serif',
                        boxShadow: '0 6px 16px rgba(42,171,238,0.35)',
                    }, children: [_jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.24 3.64 11.94c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3 10.55 18.28c-.24.24-.43.45-.85.45z" }) }), invitation.telegramLabel ?? 'TELEGRAM'] })), _jsxs(Block, { padded: false, children: [_jsx("div", { style: { position: 'relative' }, children: welcomeImg ? (_jsx("img", { src: welcomeImg, alt: "", style: { width: '100%', display: 'block' } })) : restaurantLogo ? (_jsx("div", { style: { padding: 30, textAlign: 'center', background: `linear-gradient(180deg, #f0e9d7 0%, #fdfcf8 100%)` }, children: _jsx("img", { src: restaurantLogo, alt: invitation.restaurant?.name ?? '', style: { maxWidth: 160, height: 'auto' } }) })) : null }), _jsxs("div", { style: { padding: '8px 20px 22px', textAlign: 'center' }, children: [invitation.welcomeTitle && (_jsx("p", { style: { margin: 0, fontSize: 26, fontStyle: 'italic', color: TEXT }, children: invitation.welcomeTitle })), invitation.welcomeSubtitle && (_jsx("p", { style: { margin: '4px 0 0', fontSize: 22, fontStyle: 'italic', color: TEXT }, children: invitation.welcomeSubtitle })), invitation.countdownAt && (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'inline-flex', alignItems: 'center', gap: 14, marginTop: 14, background: '#fff', borderRadius: 999, padding: '6px 14px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }, children: [invitation.countdownLabel && (_jsx("span", { style: { background: '#d22', color: '#fff', borderRadius: 999, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'system-ui, sans-serif' }, children: invitation.countdownLabel })), _jsx("span", { style: { fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 14 }, children: new Date(invitation.countdownAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) }), _jsx("span", { style: { fontFamily: 'system-ui, sans-serif', fontWeight: 700, fontSize: 14 }, children: new Date(invitation.countdownAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) })] }), cd && (_jsx("div", { style: { display: 'flex', gap: 6, justifyContent: 'center', marginTop: 18, fontFamily: 'system-ui, sans-serif' }, children: [
                                                { v: cd.days, label: 'Days' },
                                                { v: cd.hours, label: 'Hrs' },
                                                { v: cd.minutes, label: 'Min' },
                                                { v: cd.seconds, label: 'Sec' },
                                            ].map((slot) => (_jsxs("div", { style: { flex: 1, background: '#fff', borderRadius: 8, padding: '8px 4px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }, children: [_jsx("p", { style: { margin: 0, fontSize: 22, fontWeight: 800, color: TEXT }, children: String(slot.v).padStart(2, '0') }), _jsx("p", { style: { margin: '2px 0 0', fontSize: 9, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }, children: slot.label })] }, slot.label))) }))] })), invitation.welcomeMessage && (_jsx("p", { style: { margin: '20px 0 0', fontSize: 14, lineHeight: 1.5, color: TEXT, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }, children: invitation.welcomeMessage }))] })] }), invitation.menuItems.length > 0 && (_jsxs(Block, { padded: false, children: [_jsx("div", { style: { background: '#000', color: ACCENT, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: 14, letterSpacing: '0.3em', fontFamily: 'system-ui, sans-serif' }, children: "\u041C\u0415\u041D\u042E \u00B7 MENU \u00B7 \u041C\u0415\u041D\u042E" }), _jsx("div", { style: { padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 18 }, children: invitation.menuItems.map((item, i) => {
                                const left = i % 2 === 0;
                                const imgSrc = item.photoUrl ? (getPhotoUrl(item.photoUrl) ?? item.photoUrl) : null;
                                return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 14, flexDirection: left ? 'row' : 'row-reverse' }, children: [_jsxs("div", { style: { position: 'relative', width: 130, height: 130, flexShrink: 0 }, children: [_jsx("div", { style: {
                                                        position: 'absolute', inset: 0, borderRadius: '50%',
                                                        background: imgSrc ? `url(${imgSrc}) center / cover` : '#eaeaea',
                                                        border: `3px solid ${ACCENT}`,
                                                    } }), _jsx("span", { style: {
                                                        position: 'absolute', top: -4, left: -4,
                                                        width: 26, height: 26, borderRadius: '50%',
                                                        background: ACCENT, color: '#000',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: 800, fontSize: 14,
                                                        fontFamily: 'system-ui, sans-serif',
                                                        border: '2px solid #fff',
                                                    }, children: item.number })] }), _jsx("p", { style: { margin: 0, fontSize: 22, fontStyle: 'italic', fontWeight: 700, color: TEXT }, children: item.name })] }, i));
                            }) }), _jsxs("div", { style: { background: '#000', color: ACCENT, padding: '10px 0', textAlign: 'center', fontWeight: 800, fontSize: 12, letterSpacing: '0.25em', fontFamily: 'system-ui, sans-serif' }, children: ["\u2605 ", (invitation.restaurant?.name ?? 'RESTAURANT').toUpperCase(), " RESTAURANT \u2605"] })] })), invitation.galleryPhotos.length > 0 && (_jsx(Block, { padded: false, children: _jsx(GalleryCarousel, { photos: invitation.galleryPhotos }) })), _jsxs(Block, { children: [_jsx("h3", { style: { margin: '0 0 14px', textAlign: 'center', fontSize: 18, fontWeight: 800, letterSpacing: '0.15em', fontFamily: 'system-ui, sans-serif', color: TEXT }, children: invitation.contactsTitle ?? 'НАШИ КОНТАКТЫ' }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 10 }, children: [invitation.phone && (_jsxs("a", { href: `tel:${invitation.phone}`, style: contactLinkStyle, children: [_jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" }) }), "PHONE"] })), invitation.instagramUrl && (_jsxs("a", { href: invitation.instagramUrl, target: "_blank", rel: "noreferrer", style: contactLinkStyle, children: [_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "2", y: "2", width: "20", height: "20", rx: "5" }), _jsx("path", { d: "M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" }), _jsx("line", { x1: "17.5", y1: "6.5", x2: "17.51", y2: "6.5" })] }), _jsxs("div", { style: { textAlign: 'left' }, children: [_jsx("p", { style: { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }, children: "INSTAGRAM" }), _jsx("p", { style: { margin: 0, fontSize: 11, fontWeight: 400 }, children: invitation.instagramLabel ?? '' })] })] })), invitation.contactVCardUrl && (_jsxs("a", { href: invitation.contactVCardUrl, download: true, style: { ...contactLinkStyle, background: '#000', color: ACCENT }, children: [_jsxs("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }), _jsx("polyline", { points: "7 10 12 15 17 10" }), _jsx("line", { x1: "12", y1: "15", x2: "12", y2: "3" })] }), _jsxs("div", { style: { textAlign: 'left' }, children: [_jsx("p", { style: { margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }, children: "\u0421\u041E\u0425\u0420\u0410\u041D\u0418\u0422\u042C \u041A\u041E\u041D\u0422\u0410\u041A\u0422\u042B" }), invitation.restaurant?.name && (_jsxs("p", { style: { margin: 0, fontSize: 11, fontWeight: 400 }, children: ["\u00AB", invitation.restaurant.name, "\u00BB restaurant"] }))] })] }))] })] }), _jsx("p", { style: { margin: 0, textAlign: 'center', fontSize: 11, color: '#777', fontFamily: 'system-ui, sans-serif', padding: '12px 0' }, children: invitation.restaurant?.name ?? '' })] }) }));
};
const contactLinkStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
    padding: '14px 16px',
    background: '#fff',
    borderRadius: 12,
    color: TEXT,
    textDecoration: 'none',
    fontWeight: 700, fontSize: 14, letterSpacing: '0.1em',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
};
function GalleryCarousel({ photos }) {
    const [idx, setIdx] = useState(0);
    const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
    const next = () => setIdx((i) => (i + 1) % photos.length);
    const src = getPhotoUrl(photos[idx]) ?? photos[idx];
    return (_jsxs("div", { style: { position: 'relative' }, children: [_jsxs("div", { style: { aspectRatio: '4 / 3', background: '#000', position: 'relative', overflow: 'hidden' }, children: [_jsx("img", { src: src, alt: "", style: { width: '100%', height: '100%', objectFit: 'cover' } }), photos.length > 1 && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: prev, style: carouselBtn('left'), children: "\u2039" }), _jsx("button", { type: "button", onClick: next, style: carouselBtn('right'), children: "\u203A" })] }))] }), _jsx("p", { style: { margin: 0, padding: '12px 16px', textAlign: 'center', color: ACCENT, fontWeight: 700, fontSize: 13, fontFamily: 'system-ui, sans-serif' }, children: "\u041D\u0410\u0416\u041C\u0418\u0422\u0415 \u0427\u0422\u041E\u0411\u042B \u041F\u041E\u0421\u041C\u041E\u0422\u0420\u0415\u0422\u042C" }), photos.length > 1 && (_jsx("div", { style: { display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 12 }, children: photos.map((_, i) => (_jsx("span", { style: { width: 8, height: 8, borderRadius: '50%', background: i === idx ? ACCENT : '#ccc' } }, i))) }))] }));
}
function carouselBtn(side) {
    return {
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 10,
        width: 38, height: 38, borderRadius: '50%',
        background: ACCENT, color: '#fff', border: 'none',
        fontSize: 24, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    };
}
