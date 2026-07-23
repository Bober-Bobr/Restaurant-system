import { useState } from 'react';
import axios from 'axios';
import { vinviteService } from './api';
import { useVInviteStore } from './store';
import { useViT } from './i18n';

function errMessage(e: unknown): string {
  if (axios.isAxiosError(e)) return (e.response?.data as { message?: string })?.message ?? e.message;
  if (e instanceof Error) return e.message;
  return 'Error';
}

// ── Profile: account details + credentials ────────────────────────────────────
export const ViProfilePage = () => {
  const t = useViT();
  const user = useVInviteStore((s) => s.user);
  const setUser = useVInviteStore((s) => s.setUser);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const updated = await vinviteService.updateProfile({
        displayName: displayName.trim() || null,
        ...(username.trim() && username.trim() !== user.username ? { username: username.trim() } : {}),
        ...(newPassword ? { newPassword, ...(user.hasPassword ? { currentPassword } : {}) } : {}),
      });
      setUser(updated);
      setCurrentPassword('');
      setNewPassword('');
      setMsg({ ok: true, text: `✓ ${t('saved')}` });
    } catch (err) {
      setMsg({ ok: false, text: errMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vi-fade-up" style={{ maxWidth: 560 }}>
      <h1 style={{ margin: '0 0 22px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('profile')}</h1>

      {/* Account summary */}
      <div className="vi-card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        {user.avatarUrl
          ? <img src={user.avatarUrl} alt="" style={{ width: 58, height: 58, borderRadius: '50%' }} referrerPolicy="no-referrer" />
          : <span style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--vi-accent-soft)', color: 'var(--vi-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24 }}>{(user.displayName || user.username).slice(0, 1).toUpperCase()}</span>}
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{user.displayName || user.username}</p>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--vi-muted)' }}>{user.email}</p>
          <p style={{ margin: '5px 0 0', fontSize: 12, color: 'var(--vi-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>{t('member_since')}: {new Date(user.createdAt).toLocaleDateString()}</span>
            {user.googleLinked && <span className="vi-badge vi-badge-live">G · {t('google_linked')}</span>}
            {user.role === 'SYSTEM_ADMIN' && (
              <span className="vi-badge" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.4)' }}>🛠 {t('adm_badge')}</span>
            )}
          </p>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={save} className="vi-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{t('account')}</h2>
        <div>
          <label className="vi-label">{t('display_name')}</label>
          <input className="vi-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <label className="vi-label">{t('username')}</label>
          <input className="vi-input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} />
        </div>

        <h2 style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 800 }}>{t('change_password')}</h2>
        {user.hasPassword && (
          <div>
            <label className="vi-label">{t('current_password')}</label>
            <input className="vi-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </div>
        )}
        <div>
          <label className="vi-label">{t('new_password')}</label>
          <input className="vi-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={6} />
        </div>

        {msg && (
          <p className="vi-pop" style={{ margin: 0, padding: '10px 12px', borderRadius: 10, fontSize: 13, background: msg.ok ? 'rgba(34,197,94,0.12)' : 'rgba(220,38,38,0.1)', color: msg.ok ? '#16a34a' : 'var(--vi-danger)' }}>{msg.text}</p>
        )}

        <button type="submit" className="vi-btn vi-btn-primary" disabled={busy} style={{ alignSelf: 'flex-start' }}>
          {busy ? <span className="vi-spinner" style={{ width: 16, height: 16 }} /> : t('save')}
        </button>
      </form>
    </section>
  );
};
