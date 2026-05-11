import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import { useAdminStore } from '../store/admin.store';
import { translate, locales } from '../utils/translate';
import { buildSubdomainUrl, isRootDomain, toSubdomainSlug } from '../utils/subdomain';
import logoSrc from '../assets/networking-logo.png';
const formatRequestError = (error) => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data;
        if (typeof body?.message === 'string')
            return body.message;
    }
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
};
const LOCALE_LABELS = { en: 'EN', ru: 'RU', uz: 'UZ' };
export const LoginPage = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const { locale, setLocale } = useAdminStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const t = (key) => translate(key, locale);
    const redirectAfterLogin = (data) => {
        setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId, data.restaurantName);
        if (isRootDomain() && data.role === 'CHIEF_ADMIN') {
            window.location.href = buildSubdomainUrl('admin', {
                _at: data.accessToken,
                _rt: data.refreshToken,
                _u: data.username,
                _r: data.role,
                _rid: '',
                _rn: '',
                _exp: String(data.expiresIn),
            });
        }
        else if (isRootDomain() && data.role === 'OWNER') {
            window.location.href = buildSubdomainUrl('cabinet', {
                _at: data.accessToken,
                _rt: data.refreshToken,
                _u: data.username,
                _r: data.role,
                _rid: data.restaurantId ?? '',
                _rn: data.restaurantName ?? '',
                _exp: String(data.expiresIn),
            });
        }
        else if (isRootDomain() && data.restaurantName) {
            const slug = toSubdomainSlug(data.restaurantName);
            window.location.href = buildSubdomainUrl(slug, {
                _at: data.accessToken,
                _rt: data.refreshToken,
                _u: data.username,
                _r: data.role,
                _rid: data.restaurantId ?? '',
                _rn: data.restaurantName ?? '',
                _exp: String(data.expiresIn),
            });
        }
        else {
            navigate('/', { replace: true });
        }
    };
    const loginMutation = useMutation({
        mutationFn: () => authService.login(username.trim(), password),
        onSuccess: redirectAfterLogin,
    });
    const pending = loginMutation.isPending;
    const errorMessage = loginMutation.isError ? formatRequestError(loginMutation.error) : null;
    const canSubmit = username.trim().length > 0 && password.length > 0;
    const submit = (event) => {
        event.preventDefault();
        if (pending || !canSubmit)
            return;
        loginMutation.mutate();
    };
    return (_jsxs("main", { style: { maxWidth: 480, margin: '32px auto', padding: '20px 16px' }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 4 }, children: locales.map((loc) => (_jsx("button", { type: "button", onClick: () => setLocale(loc), style: {
                        padding: '4px 10px',
                        border: '1px solid',
                        borderColor: locale === loc ? '#2196F3' : '#ddd',
                        borderRadius: 4,
                        background: locale === loc ? '#e3f2fd' : '#fff',
                        color: locale === loc ? '#1565C0' : '#666',
                        fontWeight: locale === loc ? 600 : 400,
                        cursor: 'pointer',
                        fontSize: 12,
                    }, children: LOCALE_LABELS[loc] }, loc))) }), _jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("img", { src: logoSrc, alt: "Logo", style: { height: 80, width: 80, marginBottom: 12, objectFit: 'contain', display: 'block', margin: '0 auto 12px' } }), _jsx("p", { style: { color: '#666', fontSize: 14 }, children: t('login_subtitle') })] }), _jsxs("form", { onSubmit: submit, style: { display: 'grid', gap: 16, border: '1px solid #e0e0e0', borderRadius: 8, padding: 24, backgroundColor: '#fafafa' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: t('username') }), _jsx("input", { autoComplete: "username", placeholder: t('username_placeholder'), value: username, onChange: (event) => setUsername(event.target.value), style: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' } })] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: t('password') }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: showPassword ? 'text' : 'password', autoComplete: "current-password", placeholder: t('password_enter_placeholder'), value: password, onChange: (event) => setPassword(event.target.value), style: { flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' } }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), style: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12 }, children: showPassword ? '👁️‍🗨️' : '👁️' })] })] }), _jsx("button", { type: "submit", disabled: pending || !canSubmit, style: {
                            padding: '12px 16px',
                            background: pending || !canSubmit ? '#ccc' : '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: pending || !canSubmit ? 'not-allowed' : 'pointer',
                            transition: 'background 200ms'
                        }, onMouseEnter: (e) => {
                            if (!pending && canSubmit) {
                                e.currentTarget.style.background = '#1976D2';
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = pending || !canSubmit ? '#ccc' : '#2196F3';
                        }, children: pending ? t('signing_in') : t('sign_in') }), errorMessage ? (_jsx("div", { style: { padding: 12, background: '#ffebee', border: '1px solid #f44336', borderRadius: 4, color: '#c62828', fontSize: 13 }, children: errorMessage })) : null] })] }));
};
