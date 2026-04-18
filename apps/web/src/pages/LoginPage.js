import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
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
    const messages = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
    const valid = checks.length && checks.uppercase && checks.lowercase && checks.numbers;
    return {
        score,
        message: messages[score] || 'Very weak',
        valid
    };
};
export const LoginPage = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [tab, setTab] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const passwordStrength = tab === 'register' ? checkPasswordStrength(password) : null;
    const loginMutation = useMutation({
        mutationFn: () => authService.login(username.trim(), password),
        onSuccess: (data) => {
            setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId);
            navigate('/', { replace: true });
        }
    });
    const registerMutation = useMutation({
        mutationFn: () => authService.register(username.trim(), password),
        onSuccess: (data) => {
            setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn, data.role, data.restaurantId);
            navigate('/', { replace: true });
        }
    });
    const pending = loginMutation.isPending || registerMutation.isPending;
    const errorMessage = loginMutation.isError
        ? formatRequestError(loginMutation.error)
        : registerMutation.isError
            ? formatRequestError(registerMutation.error)
            : null;
    const canSubmitRegister = username.trim().length >= 3 && passwordStrength?.valid;
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
    return (_jsxs("main", { style: { maxWidth: 480, margin: '32px auto', padding: 20 }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 32 }, children: [_jsx("h1", { style: { marginBottom: 8 }, children: "Banquet Admin" }), _jsx("p", { style: { color: '#666', fontSize: 14 }, children: tab === 'login' ? 'Sign in to manage events and menu' : 'Create a new restaurant owner account' })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #eee', borderRadius: '8px 8px 0 0' }, children: [_jsx("button", { type: "button", onClick: () => {
                            setTab('login');
                            setPassword('');
                        }, disabled: tab === 'login', style: {
                            flex: 1,
                            padding: '12px 16px',
                            border: 'none',
                            borderBottom: tab === 'login' ? '2px solid #2196F3' : 'none',
                            background: 'none',
                            color: tab === 'login' ? '#2196F3' : '#999',
                            fontWeight: tab === 'login' ? 600 : 400,
                            cursor: tab === 'login' ? 'default' : 'pointer',
                            fontSize: 14
                        }, children: "Sign In" }), _jsx("button", { type: "button", onClick: () => {
                            setTab('register');
                            setPassword('');
                        }, disabled: tab === 'register', style: {
                            flex: 1,
                            padding: '12px 16px',
                            border: 'none',
                            borderBottom: tab === 'register' ? '2px solid #2196F3' : 'none',
                            background: 'none',
                            color: tab === 'register' ? '#2196F3' : '#999',
                            fontWeight: tab === 'register' ? 600 : 400,
                            cursor: tab === 'register' ? 'default' : 'pointer',
                            fontSize: 14
                        }, children: "Create Account" })] }), _jsxs("form", { onSubmit: submit, style: { display: 'grid', gap: 16, border: '1px solid #e0e0e0', borderRadius: '0 0 8px 8px', padding: 24, backgroundColor: '#fafafa' }, children: [_jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: "Username" }), _jsx("input", { autoComplete: "username", placeholder: "Enter your username", value: username, onChange: (event) => setUsername(event.target.value), style: {
                                    padding: '10px 12px',
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    fontSize: 14,
                                    fontFamily: 'inherit'
                                } }), tab === 'register' && username && (_jsxs("span", { style: { fontSize: 12, color: username.length >= 3 ? '#4CAF50' : '#f44336' }, children: [username.length >= 3 ? '✓' : '✗', " Username must be 3+ characters"] }))] }), _jsxs("label", { style: { display: 'grid', gap: 6 }, children: [_jsx("span", { style: { fontSize: 13, fontWeight: 500, color: '#333' }, children: "Password" }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx("input", { type: showPassword ? 'text' : 'password', autoComplete: tab === 'login' ? 'current-password' : 'new-password', placeholder: tab === 'login' ? 'Enter your password' : 'Create a strong password', value: password, onChange: (event) => setPassword(event.target.value), style: {
                                            flex: 1,
                                            padding: '10px 12px',
                                            border: '1px solid #ddd',
                                            borderRadius: 4,
                                            fontSize: 14,
                                            fontFamily: 'inherit'
                                        } }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), style: {
                                            padding: '10px 12px',
                                            border: '1px solid #ddd',
                                            borderRadius: 4,
                                            background: '#fff',
                                            cursor: 'pointer',
                                            fontSize: 12
                                        }, children: showPassword ? '👁️‍🗨️' : '👁️' })] })] }), tab === 'register' && password && (_jsxs("div", { style: { display: 'grid', gap: 8 }, children: [_jsx("div", { style: { display: 'flex', gap: 4 }, children: [1, 2, 3, 4, 5].map((level) => (_jsx("div", { style: {
                                        flex: 1,
                                        height: 4,
                                        borderRadius: 2,
                                        background: level <= passwordStrength.score ? '#2196F3' : '#e0e0e0'
                                    } }, level))) }), _jsxs("span", { style: {
                                    fontSize: 12,
                                    color: passwordStrength.valid ? '#4CAF50' : '#f44336',
                                    fontWeight: 500
                                }, children: [passwordStrength.valid ? '✓' : '✗', " ", passwordStrength.message] }), _jsxs("ul", { style: { fontSize: 12, color: '#666', margin: 0, paddingLeft: 16 }, children: [_jsx("li", { style: { color: password.length >= 8 ? '#4CAF50' : '#999' }, children: "At least 8 characters" }), _jsx("li", { style: { color: /[A-Z]/.test(password) ? '#4CAF50' : '#999' }, children: "One uppercase letter" }), _jsx("li", { style: { color: /[a-z]/.test(password) ? '#4CAF50' : '#999' }, children: "One lowercase letter" }), _jsx("li", { style: { color: /[0-9]/.test(password) ? '#4CAF50' : '#999' }, children: "One number" })] }), _jsx("p", { style: { fontSize: 12, color: '#999', margin: '8px 0 0 0' }, children: "First admin to register can always proceed. Later registrations require server setting." })] })), _jsx("button", { type: "submit", disabled: pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin), style: {
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
                            ? tab === 'login'
                                ? 'Signing in...'
                                : 'Creating account...'
                            : tab === 'login'
                                ? 'Sign In'
                                : 'Create Account' }), errorMessage ? (_jsx("div", { style: { padding: 12, background: '#ffebee', border: '1px solid #f44336', borderRadius: 4, color: '#c62828', fontSize: 13 }, children: errorMessage })) : null] })] }));
};
