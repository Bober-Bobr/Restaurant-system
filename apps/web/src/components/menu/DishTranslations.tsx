import { useState } from 'react';
import type { DishI18n } from '../../types/domain';
import { translate, type Locale } from '../../utils/translate';
import { Input } from '../ui/input';

type Props = {
  locale: Locale;
  nameI18n: DishI18n | null | undefined;
  descriptionI18n: DishI18n | null | undefined;
  onChange: (next: { nameI18n: DishI18n; descriptionI18n: DishI18n }) => void;
  defaultOpen?: boolean;
  hideToggle?: boolean;
};

const LANG_KEYS: { code: keyof DishI18n; labelKey: Parameters<typeof translate>[0] }[] = [
  { code: 'en', labelKey: 'english' },
  { code: 'ru', labelKey: 'russian' },
  { code: 'uz', labelKey: 'uzbek' },
];

// Collapsible per-language name/description editor shared by every dish editor.
export const DishTranslations = ({ locale, nameI18n, descriptionI18n, onChange, defaultOpen = false, hideToggle = false }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const t = (k: Parameters<typeof translate>[0]) => translate(k, locale);
  const names = nameI18n ?? {};
  const descs = descriptionI18n ?? {};

  const setName = (code: keyof DishI18n, value: string) =>
    onChange({ nameI18n: { ...names, [code]: value }, descriptionI18n: { ...descs } });
  const setDesc = (code: keyof DishI18n, value: string) =>
    onChange({ nameI18n: { ...names }, descriptionI18n: { ...descs, [code]: value } });

  return (
    <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
      {!hideToggle && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
            color: '#c9a42c', fontSize: 13, fontWeight: 600,
          }}
        >
          <span style={{ transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
          {t('translations')}
        </button>
      )}
      {open && (
        <div style={{ display: 'grid', gap: 12, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ margin: 0, fontSize: 11, color: 'rgba(226,232,240,0.5)' }}>{t('translations_hint')}</p>
          {LANG_KEYS.map(({ code, labelKey }) => (
            <div key={code} style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(226,232,240,0.7)' }}>{t(labelKey)}</span>
              <Input value={names[code] ?? ''} onChange={(e) => setName(code, e.target.value)} placeholder={t('name')} />
              <Input value={descs[code] ?? ''} onChange={(e) => setDesc(code, e.target.value)} placeholder={t('description')} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
