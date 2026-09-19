import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shellSettingsService } from '../services/shellSettings.service';
import { PARTICLE_CHOICES, type ShellSettings, type ShellSystem } from '../utils/shellSettings';
import type { translate } from '../utils/translate';

type T = (key: Parameters<typeof translate>[0], params?: Record<string, string | number>) => string;

const SWITCHES = [
  { key: 'animations', label: 'shell_animations', help: 'shell_animations_help' },
  { key: 'music', label: 'shell_music', help: 'shell_music_help' },
  { key: 'trail', label: 'shell_trail', help: 'shell_trail_help' },
] as const;

/**
 * "Shell settings" — the visual effects of ONE guest-facing shell: the tablet
 * for the main admin, the catering site for the food admin (see
 * utils/shellSettings.ts). One section per system, each with its own query key
 * and its own save, so nothing on the page can carry one system's switches
 * into the other.
 *
 * An explicit Save rather than a save per click, like the category lists above
 * it: switching music off on a kiosk that is in use is a decision, and a row of
 * switches that each fire a request is easy to brush. The section is marked
 * clean only once the server confirms, as the category lists are.
 */
export function ShellSettingsSection({ system, t }: { system: ShellSystem; t: T }) {
  const queryClient = useQueryClient();
  const key = ['shell-settings', system];
  const query = useQuery({ queryKey: key, queryFn: () => shellSettingsService.get(system) });
  const [draft, setDraft] = useState<ShellSettings | null>(null);

  const saved = query.data?.settings ?? null;
  useEffect(() => { if (saved) setDraft(saved); }, [saved]);

  const mutation = useMutation({
    mutationFn: (settings: ShellSettings) => shellSettingsService.save(system, settings),
    onSuccess: (data) => queryClient.setQueryData(key, data),
  });

  const dirty = !!draft && !!saved && (Object.keys(draft) as (keyof ShellSettings)[]).some((k) => draft[k] !== saved[k]);
  // 'custom' is an image uploaded in the manager portal, and only the tablet
  // has one. Offered only while it is the current value, so choosing another
  // kind here is possible but choosing an image that is not there is not.
  const choices: string[] = draft?.particles === 'custom' ? [...PARTICLE_CHOICES, 'custom'] : [...PARTICLE_CHOICES];

  return (
    <section className="adm-card adm-section" style={{ marginTop: 24, padding: 20 }}>
      <h2 className="adm-heading" style={{ margin: 0 }}>{t('shell_settings')}</h2>
      <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 700 }}>
        {t(system === 'tablet' ? 'shell_for_tablet' : 'shell_for_catering')}
      </p>
      <p style={{ margin: '4px 0 18px', fontSize: 12, color: 'rgba(var(--adm-text-rgb),0.55)', maxWidth: 620 }}>
        {t(system === 'tablet' ? 'shell_for_tablet_help' : 'shell_for_catering_help')}
      </p>

      {query.isError && <p style={{ color: '#fca5a5', fontSize: 13 }}>{t('settings_save_failed')}</p>}

      {draft && (
        <div style={{ display: 'grid', gap: 4 }}>
          {SWITCHES.map((s) => (
            <label key={s.key} className="shell-row">
              <span style={{ display: 'grid', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{t(s.label)}</span>
                <span style={{ fontSize: 12, color: 'rgba(var(--adm-text-rgb),0.5)' }}>{t(s.help)}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                className="shell-switch"
                checked={draft[s.key]}
                onChange={(e) => setDraft({ ...draft, [s.key]: e.target.checked })}
                data-setting={s.key}
              />
            </label>
          ))}
          <label className="shell-row">
            <span style={{ display: 'grid', gap: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{t('particles')}</span>
              <span style={{ fontSize: 12, color: 'rgba(var(--adm-text-rgb),0.5)' }}>{t('shell_particles_help')}</span>
            </span>
            <select
              className="adm-input"
              style={{ width: 'auto', minWidth: 180 }}
              value={draft.particles}
              onChange={(e) => setDraft({ ...draft, particles: e.target.value })}
              data-setting="particles"
            >
              {choices.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`particle_${kind}` as Parameters<T>[0])}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button
          type="button"
          className="adm-btn-primary"
          disabled={!dirty || mutation.isPending}
          onClick={() => draft && mutation.mutate(draft)}
        >
          {mutation.isPending ? t('saving') : t('save')}
        </button>
        {mutation.isSuccess && !dirty && <span style={{ color: '#4ade80', fontSize: 13 }}>{t('settings_saved')}</span>}
        {mutation.isError && <span style={{ color: '#fca5a5', fontSize: 13 }}>{t('settings_save_failed')}</span>}
      </div>

      <style>{`
        .shell-row {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 12px 0; border-top: 1px solid var(--adm-line); cursor: pointer;
        }
        .shell-row:first-child { border-top: 0; }
        .shell-switch {
          appearance: none; -webkit-appearance: none; flex-shrink: 0; cursor: pointer;
          width: 44px; height: 24px; border-radius: 999px; position: relative; margin: 0;
          background: rgba(var(--adm-text-rgb), 0.18); transition: background 0.18s;
        }
        .shell-switch::after {
          content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
          border-radius: 50%; background: #fff; transition: transform 0.18s;
        }
        .shell-switch:checked { background: var(--adm-accent); }
        .shell-switch:checked::after { transform: translateX(20px); }
        .shell-switch:focus-visible { outline: 2px solid var(--adm-accent); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .shell-switch, .shell-switch::after { transition: none; }
        }
      `}</style>
    </section>
  );
}
