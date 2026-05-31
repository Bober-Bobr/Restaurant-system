import { useState } from 'react';
import axios from 'axios';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { translate, type Locale } from '../utils/translate';

const formatError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown; errors?: { message?: string }[] } | undefined;
    if (Array.isArray(body?.errors) && typeof body.errors[0]?.message === 'string') return body.errors[0]!.message!;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

const inputStyle: React.CSSProperties = {
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

export const EditCredentialsForm = ({
  userId,
  currentUsername,
  onClose,
  invalidateKeys,
  locale,
}: {
  userId: string;
  currentUsername: string;
  onClose: () => void;
  invalidateKeys: readonly (string | readonly string[])[];
  locale: Locale;
}) => {
  const t = (key: Parameters<typeof translate>[0]) => translate(key, locale);
  const queryClient = useQueryClient();

  const [username, setUsername] = useState(currentUsername);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: { username?: string; password?: string } = {};
      const u = username.trim();
      if (u && u !== currentUsername) payload.username = u;
      if (password) payload.password = password;
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

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(201,164,44,0.3)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {t('new_username')}
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
            autoComplete="off"
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {t('new_password')}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password_blank_keep')}
            style={inputStyle}
            autoComplete="new-password"
          />
        </label>
      </div>

      {error && (
        <p style={{ margin: 0, fontSize: 12, color: '#fca5a5' }}>{error}</p>
      )}
      {savedFlash && (
        <p style={{ margin: 0, fontSize: 12, color: '#4ade80', fontWeight: 600 }}>✓ {t('credentials_saved')}</p>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600,
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(226,232,240,0.7)',
            cursor: 'pointer',
          }}
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="adm-btn-primary"
          style={{ padding: '6px 14px', fontSize: 12, opacity: canSubmit ? 1 : 0.5 }}
        >
          {mutation.isPending ? '...' : t('save')}
        </button>
      </div>
    </div>
  );
};
