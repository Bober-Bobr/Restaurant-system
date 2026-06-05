import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { translate } from '../utils/translate';
const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
function isMobileDevice() {
    if (typeof window === 'undefined')
        return false;
    const ua = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua))
        return true;
    // Catch tablets without "Mobile" in UA (e.g. iPad on iPadOS 13+)
    if (navigator.maxTouchPoints > 1 && window.matchMedia('(max-width: 1024px)').matches)
        return true;
    return false;
}
function isIOS() {
    if (typeof window === 'undefined')
        return false;
    return /iPhone|iPad|iPod/.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
}
function isStandalone() {
    if (typeof window === 'undefined')
        return false;
    return window.matchMedia('(display-mode: standalone)').matches
        || navigator.standalone === true;
}
function recentlyDismissed() {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw)
            return false;
        return Date.now() - Number(raw) < DISMISS_TTL_MS;
    }
    catch {
        return false;
    }
}
export const PWAInstallPrompt = ({ locale }) => {
    const t = (key) => translate(key, locale);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [show, setShow] = useState(false);
    const [ios, setIos] = useState(false);
    useEffect(() => {
        if (!isMobileDevice() || isStandalone() || recentlyDismissed())
            return;
        if (isIOS()) {
            setIos(true);
            setShow(true);
            return;
        }
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShow(true);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);
    const dismiss = () => {
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        }
        catch { }
        setShow(false);
    };
    const install = async () => {
        if (!deferredPrompt)
            return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShow(false);
        }
        else {
            dismiss();
        }
        setDeferredPrompt(null);
    };
    if (!show)
        return null;
    return (_jsxs("div", { className: "scale-in", style: {
            position: 'fixed',
            left: 16, right: 16, bottom: 16,
            zIndex: 50,
            maxWidth: 460, margin: '0 auto',
            padding: 16,
            borderRadius: 18,
            background: 'rgba(15,23,42,0.95)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(201,164,44,0.35)',
            boxShadow: '0 14px 40px rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', gap: 14,
        }, children: [_jsx("img", { src: "/pwa-icon-192.png", alt: "", style: { width: 48, height: 48, borderRadius: 12, flexShrink: 0 } }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("p", { style: { margin: 0, fontWeight: 700, color: '#f8fafc', fontSize: 14 }, children: t('install_app') }), _jsx("p", { style: { margin: '4px 0 0', fontSize: 12, color: 'rgba(226,232,240,0.65)', lineHeight: 1.4 }, children: ios ? t('install_ios_hint') : t('install_app_desc') })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }, children: [!ios && (_jsx("button", { type: "button", onClick: install, style: {
                            padding: '8px 14px', fontSize: 12, fontWeight: 700,
                            borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg, #c9a42c 0%, #d4af37 100%)',
                            color: '#1a3320', cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }, children: t('install_app') })), _jsx("button", { type: "button", onClick: dismiss, style: {
                            padding: '6px 12px', fontSize: 11, fontWeight: 600,
                            borderRadius: 8,
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(226,232,240,0.6)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                        }, children: t('later') })] })] }));
};
