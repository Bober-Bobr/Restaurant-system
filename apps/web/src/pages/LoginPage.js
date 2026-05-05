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
const checkPasswordStrength = (password) => {
    let score = 0;
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        numbers: /[0-9]/.test(password),
        special: /[!@#$%^&*]/.test(password)
    };
    if (checks.length)
        score++;
    if (checks.uppercase)
        score++;
    if (checks.lowercase)
        score++;
    if (checks.numbers)
        score++;
    if (checks.special)
        score++;
    const messageKeys = ['pw_very_weak', 'pw_weak', 'pw_fair', 'pw_good', 'pw_strong', 'pw_very_strong'];
    const valid = checks.length && checks.uppercase && checks.lowercase && checks.numbers;
    return { score, messageKey: messageKeys[score] ?? 'pw_very_weak', valid };
};
const LOCALE_LABELS = { en: 'EN', ru: 'RU', uz: 'UZ' };
export const LoginPage = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const { locale, setLocale } = useAdminStore();
    const [tab, setTab] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [restaurantName, setRestaurantName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const t = (key) => translate(key, locale);
    const passwordStrength = tab === 'register' ? checkPasswordStrength(password) : null;
    const redirectAfterLogin = (data) => {
        setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId, data.restaurantName);
        if (isRootDomain() && data.restaurantName && data.role !== 'OWNER') {
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
    const registerMutation = useMutation({
        mutationFn: () => authService.publicRegister(username.trim(), password, restaurantName.trim()),
        onSuccess: redirectAfterLogin,
    });
    const pending = loginMutation.isPending || registerMutation.isPending;
    const errorMessage = loginMutation.isError
        ? formatRequestError(loginMutation.error)
        : registerMutation.isError
            ? formatRequestError(registerMutation.error)
            : null;
    const canSubmitRegister = username.trim().length >= 3 && (passwordStrength?.valid ?? false) && restaurantName.trim().length >= 1;
    const canSubmitLogin = username.trim().length > 0 && password.length > 0;
    const submit = (event) => {
        event.preventDefault();
        if (pending)
            return;
        if (tab === 'login') {
            if (!canSubmitLogin)
                return;
            loginMutation.mutate();
        }
        else {
            if (!canSubmitRegister)
                return;
            registerMutation.mutate();
        }
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
                    }, children: LOCALE_LABELS[loc] }, loc))) }), _jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("h1", { style: { marginBottom: 8 }, children: t('banquet_admin') }), _jsx("p", { style: { color: '#666', fontSize: 14 }, children: tab === 'login' ? t('login_subtitle') : t('register_subtitle') })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #eee', borderRadius: '8px 8px 0 0' }, children: [_jsx("button", { type: "button", onClick: () => { setTab('login'); setPassword(''); setRestaurantName(''); }, disabled: tab === 'login', style: {
                            flex: 1,
                            padding: '12px 16px',
                            border: 'none',
                            borderBottom: tab === 'login' ? '2px solid #2196F3' : 'none',
                            background: 'none',
                            color: tab === 'login' ? '#2196F3' : '#999',
                            fontWeight: tab === 'login' ? 600 : 400,
                            cursor: tab === 'login' ? 'default' : 'pointer',
                            fontSize: 14
                        }, children: t('sign_in') }), _jsx("button", { type: "button", onClick: () => { setTab('register'); setPassword(''); }, disabled: tab === 'register', style: {
                            flex: 1,
                            padding: '12px 16px',
                            border: 'none',
                            borderBottom: tab === 'register' ? '2px solid #2196F3' : 'none',
                            background: 'none',
                            color: tab === 'register' ? '#2196F3' : '#999',
                            fontWeight: tab === 'register' ? 600 : 400,
                            cursor: tab === 'register' ? 'default' : 'pointer',
                            fontSize: 14
                        }, children: t('create_account') })] }), _jsxs("form", { onSubmit: submit, style: { display: 'grid', gap: 16, border: '1px solid #e0e0e0', borderRadius: '0 0 8px 8px', padding: 24, backgroundColor: '#fafafa' }, children: [tab === 'register' && (_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: t('restaurant_field_label') }), _jsx("input", { autoComplete: "organization", placeholder: t('restaurant_field_placeholder'), value: restaurantName, onChange: (event) => setRestaurantName(event.target.value), style: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' } }), restaurantName && (_jsxs("span", { style: { fontSize: 12, color: restaurantName.trim().length >= 1 ? '#4CAF50' : '#f44336' }, children: [restaurantName.trim().length >= 1 ? '✓' : '✗', " ", t('restaurant_required')] }))] })), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: t('username') }), _jsx("input", { autoComplete: "username", placeholder: t('username_placeholder'), value: username, onChange: (event) => setUsername(event.target.value), style: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' } }), tab === 'register' && username && (_jsxs("span", { style: { fontSize: 12, color: username.length >= 3 ? '#4CAF50' : '#f44336' }, children: [username.length >= 3 ? '✓' : '✗', " ", t('username_min_length')] }))] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: t('password') }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: showPassword ? 'text' : 'password', autoComplete: tab === 'login' ? 'current-password' : 'new-password', placeholder: tab === 'login' ? t('password_enter_placeholder') : t('password_create_placeholder'), value: password, onChange: (event) => setPassword(event.target.value), style: { flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, fontSize: 14, fontFamily: 'inherit' } }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), style: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 12 }, children: showPassword ? '👁️‍🗨️' : '👁️' })] })] }), tab === 'register' && password && (_jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: [1, 2, 3, 4, 5].map((level) => (_jsx("div", { style: {
                                        flex: 1,
                                        height: 4,
                                        borderRadius: 2,
                                        background: level <= passwordStrength.score ? '#2196F3' : '#e0e0e0'
                                    } }, level))) }), _jsxs("span", { style: { fontSize: 12, color: passwordStrength.valid ? '#4CAF50' : '#f44336', fontWeight: 500 }, children: [passwordStrength.valid ? '✓' : '✗', " ", t(passwordStrength.messageKey)] }), _jsxs("ul", { style: { fontSize: 12, color: '#666', margin: 0, paddingLeft: 16 }, children: [_jsx("li", { style: { color: password.length >= 8 ? '#4CAF50' : '#999' }, children: t('pw_req_length') }), _jsx("li", { style: { color: /[A-Z]/.test(password) ? '#4CAF50' : '#999' }, children: t('pw_req_upper') }), _jsx("li", { style: { color: /[a-z]/.test(password) ? '#4CAF50' : '#999' }, children: t('pw_req_lower') }), _jsx("li", { style: { color: /[0-9]/.test(password) ? '#4CAF50' : '#999' }, children: t('pw_req_number') })] }), _jsx("p", { style: { fontSize: 12, color: '#999', margin: '8px 0 0 0' }, children: t('first_admin_note') })] })), _jsx("button", { type: "submit", disabled: pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin), style: {
                            padding: '12px 16px',
                            background: pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin) ? '#ccc' : '#2196F3',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin) ? 'not-allowed' : 'pointer',
                            transition: 'background 200ms'
                        }, onMouseEnter: (e) => {
                            if (!pending && (tab === 'register' ? canSubmitRegister : canSubmitLogin)) {
                                e.currentTarget.style.background = '#1976D2';
                            }
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.background = '#2196F3';
                        }, children: pending
                            ? tab === 'login' ? t('signing_in') : t('creating_account')
                            : tab === 'login' ? t('sign_in') : t('create_account') }), errorMessage ? (_jsx("div", { style: { padding: 12, background: '#ffebee', border: '1px solid #f44336', borderRadius: 4, color: '#c62828', fontSize: 13 }, children: errorMessage })) : null] })] }));
};
