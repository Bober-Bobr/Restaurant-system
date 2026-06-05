import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { translate } from '../utils/translate';
const formatError = (error) => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data;
        if (Array.isArray(body?.errors) && typeof body.errors[0]?.message === 'string')
            return body.errors[0].message;
        if (typeof body?.message === 'string')
            return body.message;
    }
    if (error instanceof Error)
        return error.message;
    return 'Something went wrong';
};
const inputStyle = {
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '7px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
};
export const EditCredentialsForm = ({ userId, currentUsername, onClose, invalidateKeys, locale, }) => {
    const t = (key) => translate(key, locale);
    const queryClient = useQueryClient();
    const [username, setUsername] = useState(currentUsername);
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [savedFlash, setSavedFlash] = useState(false);
    const mutation = useMutation({
        mutationFn: () => {
            const payload = {};
            const u = username.trim();
            if (u && u !== currentUsername)
                payload.username = u;
            if (password)
                payload.password = password;
            return authService.updateUserCredentials(userId, payload);
        },
        onSuccess: () => {
            setError(null);
            setSavedFlash(true);
            setPassword('');
            for (const key of invalidateKeys) {
                const queryKey = Array.isArray(key) ? key : [key];
                queryClient.invalidateQueries({ queryKey });
            }
            setTimeout(() => { setSavedFlash(false); onClose(); }, 900);
        },
        onError: (e) => setError(formatError(e)),
    });
    const u = username.trim();
    const usernameChanged = !!u && u !== currentUsername;
    const canSubmit = (usernameChanged || password.length > 0) && !mutation.isPending;
    return (_jsxs("div", { style: {
            padding: 12,
            borderRadius: 10,
            background: 'rgba(15,23,42,0.7)',
            border: '1px solid rgba(201,164,44,0.3)',
            display: 'flex', flexDirection: 'column', gap: 10,
        }, children: [_jsxs("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }, children: [_jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em' }, children: t('new_username') }), _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), style: inputStyle, autoComplete: "off" })] }), _jsxs("label", { style: { display: 'grid', gap: 4 }, children: [_jsx("span", { style: { fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em' }, children: t('new_password') }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: t('password_blank_keep'), style: inputStyle, autoComplete: "new-password" })] })] }), error && (_jsx("p", { style: { margin: 0, fontSize: 12, color: '#fca5a5' }, children: error })), savedFlash && (_jsxs("p", { style: { margin: 0, fontSize: 12, color: '#4ade80', fontWeight: 600 }, children: ["\u2713 ", t('credentials_saved')] })), _jsxs("div", { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' }, children: [_jsx("button", { type: "button", onClick: onClose, disabled: mutation.isPending, style: {
                            padding: '6px 14px', fontSize: 12, fontWeight: 600,
                            borderRadius: 8,
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(226,232,240,0.7)',
                            cursor: 'pointer',
                        }, children: t('cancel') }), _jsx("button", { type: "button", onClick: () => mutation.mutate(), disabled: !canSubmit, className: "adm-btn-primary", style: { padding: '6px 14px', fontSize: 12, opacity: canSubmit ? 1 : 0.5 }, children: mutation.isPending ? '...' : t('save') })] })] }));
};
