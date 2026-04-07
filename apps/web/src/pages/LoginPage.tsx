import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth.store';
import logo from '../assets/logo.png';

const formatRequestError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { message?: unknown } | undefined;
    if (typeof body?.message === 'string') return body.message;
  }
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
};

const checkPasswordStrength = (
  password: string
): { score: number; message: string; valid: boolean } => {
  let score = 0;
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /[0-9]/.test(password),
    special: /[!@#$%^&*]/.test(password)
  };

  if (checks.length) score++;
  if (checks.uppercase) score++;
  if (checks.lowercase) score++;
  if (checks.numbers) score++;
  if (checks.special) score++;

  const messages = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const valid = checks.length && checks.uppercase && checks.lowercase && checks.numbers;

  return {
    score,
    message: messages[score] || 'Very weak',
    valid
  };
};

type Tab = 'login' | 'register';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { setAuth, logout } = useAuthStore();
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const passwordStrength = tab === 'register' ? checkPasswordStrength(password) : null;

  const loginMutation = useMutation({
    mutationFn: () => authService.login(username.trim(), password),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn);
      navigate('/', { replace: true });
    }
  });

  const registerMutation = useMutation({
    mutationFn: () => authService.register(username.trim(), password),
    onSuccess: (data) => {
      setAuth(data.accessToken, data.refreshToken, data.username, data.expiresIn);
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    if (tab === 'login') {
      if (!canSubmitLogin) return;
      loginMutation.mutate();
    } else {
      if (!canSubmitRegister) return;
      registerMutation.mutate();
    }
  };

  return (
    <main style={{ maxWidth: 480, margin: '32px auto', padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img
          src={logo}
          alt="Restaurant logo"
          style={{ width: 96, height: 'auto', margin: '0 auto 16px', borderRadius: 16, objectFit: 'contain' }}
        />
        <h1 style={{ marginBottom: 8 }}>Banquet Admin</h1>
        <p style={{ color: '#666', fontSize: 14 }}>Sign in to manage events and menu</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid #eee', borderRadius: '8px 8px 0 0' }}>
        <button
          type="button"
          onClick={() => {
            setTab('login');
            setPassword('');
          }}
          disabled={tab === 'login'}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderBottom: tab === 'login' ? '2px solid #2196F3' : 'none',
            background: 'none',
            color: tab === 'login' ? '#2196F3' : '#999',
            fontWeight: tab === 'login' ? 600 : 400,
            cursor: tab === 'login' ? 'default' : 'pointer',
            fontSize: 14
          }}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('register');
            setPassword('');
          }}
          disabled={tab === 'register'}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: 'none',
            borderBottom: tab === 'register' ? '2px solid #2196F3' : 'none',
            background: 'none',
            color: tab === 'register' ? '#2196F3' : '#999',
            fontWeight: tab === 'register' ? 600 : 400,
            cursor: tab === 'register' ? 'default' : 'pointer',
            fontSize: 14
          }}
        >
          Create Account
        </button>
      </div>

      <form
        onSubmit={submit}
        style={{ display: 'grid', gap: 16, border: '1px solid #e0e0e0', borderRadius: '0 0 8px 8px', padding: 24, backgroundColor: '#fafafa' }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>Username</span>
          <input
            autoComplete="username"
            placeholder="Enter your username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            style={{
              padding: '10px 12px',
              border: '1px solid #ddd',
              borderRadius: 4,
              fontSize: 14,
              fontFamily: 'inherit'
            }}
          />
          {tab === 'register' && username && (
            <span style={{ fontSize: 12, color: username.length >= 3 ? '#4CAF50' : '#f44336' }}>
              {username.length >= 3 ? '✓' : '✗'} Username must be 3+ characters
            </span>
          )}
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>Password</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              placeholder={tab === 'login' ? 'Enter your password' : 'Create a strong password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={{
                flex: 1,
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 4,
                fontSize: 14,
                fontFamily: 'inherit'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: 4,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {showPassword ? '👁️‍🗨️' : '👁️'}
            </button>
          </div>
        </label>

        {tab === 'register' && password && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: level <= passwordStrength!.score ? '#2196F3' : '#e0e0e0'
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: 12,
                color: passwordStrength!.valid ? '#4CAF50' : '#f44336',
                fontWeight: 500
              }}
            >
              {passwordStrength!.valid ? '✓' : '✗'} {passwordStrength!.message}
            </span>
            <ul style={{ fontSize: 12, color: '#666', margin: 0, paddingLeft: 16 }}>
              <li style={{ color: password.length >= 8 ? '#4CAF50' : '#999' }}>At least 8 characters</li>
              <li style={{ color: /[A-Z]/.test(password) ? '#4CAF50' : '#999' }}>One uppercase letter</li>
              <li style={{ color: /[a-z]/.test(password) ? '#4CAF50' : '#999' }}>One lowercase letter</li>
              <li style={{ color: /[0-9]/.test(password) ? '#4CAF50' : '#999' }}>One number</li>
            </ul>
            <p style={{ fontSize: 12, color: '#999', margin: '8px 0 0 0' }}>
              First admin to register can always proceed. Later registrations require server setting.
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={
            pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin)
          }
          style={{
            padding: '12px 16px',
            background: pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin) ? '#ccc' : '#2196F3',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 14,
            fontWeight: 600,
            cursor:
              pending || (tab === 'register' ? !canSubmitRegister : !canSubmitLogin) ? 'not-allowed' : 'pointer',
            transition: 'background 200ms'
          }}
          onMouseEnter={(e) => {
            if (!pending && (tab === 'register' ? canSubmitRegister : canSubmitLogin)) {
              (e.currentTarget as HTMLButtonElement).style.background = '#1976D2';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#2196F3';
          }}
        >
          {pending
            ? tab === 'login'
              ? 'Signing in...'
              : 'Creating account...'
            : tab === 'login'
              ? 'Sign In'
              : 'Create Account'}
        </button>

        {errorMessage ? (
          <div style={{ padding: 12, background: '#ffebee', border: '1px solid #f44336', borderRadius: 4, color: '#c62828', fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}
      </form>

      <p style={{ marginTop: 20, fontSize: 13, color: '#666' }}>
        <Link
          to="/tablet"
          style={{ color: '#2196F3', textDecoration: 'none' }}
        >
          Open tablet menu (public, no login)
        </Link>
      </p>
    </main>
  );
};
