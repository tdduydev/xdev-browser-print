import { useState } from 'react';
import type { ExtensionSettings, PrintConfig } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import { setLanguage, t } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

export function Settings({ config, onSaved }: { config: PrintConfig; onSaved: () => void }) {
  const [s, setS] = useState<ExtensionSettings>(config.settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof ExtensionSettings>(k: K, v: ExtensionSettings[K]) => setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    try {
      await callBackground('settings.update', { patch: s });
      setLanguage(s.language);
      setMsg({ ok: true, text: t('common.saved') });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };

  return (
    <>
      <h1>{t('settings.title')}</h1>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <div className="card" style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
        <label>
          {t('settings.language')}
          <select value={s.language} onChange={(e) => set('language', e.target.value as ExtensionSettings['language'])} data-testid="settings-language">
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t('settings.maxJob')}
          <input type="number" min={1} max={50} value={Math.round(s.maxJobBytes / 1024 / 1024)} onChange={(e) => set('maxJobBytes', Number(e.target.value) * 1024 * 1024)} />
        </label>
        <div className="row">
          <label>
            {t('settings.rate')}
            <input type="number" min={1} value={s.rateLimitJobs} onChange={(e) => set('rateLimitJobs', Number(e.target.value))} />
          </label>
          <label>
            {t('settings.window')}
            <input type="number" min={1} value={s.rateLimitWindowMs / 1000} onChange={(e) => set('rateLimitWindowMs', Number(e.target.value) * 1000)} />
          </label>
        </div>
        <label>
          {t('settings.history')}
          <input type="number" min={10} max={5000} value={s.historyLimit} onChange={(e) => set('historyLimit', Number(e.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.allowSiteConfigure} onChange={(e) => set('allowSiteConfigure', e.target.checked)} /> {t('settings.allowConfigure')}
        </label>
        <label className="check">
          <input type="checkbox" checked={s.allowLocalhost} onChange={(e) => set('allowLocalhost', e.target.checked)} /> {t('settings.allowLocalhost')}
        </label>
        <div>
          <button className="primary" onClick={() => void save()} data-testid="settings-save">{t('common.save')}</button>
        </div>
      </div>
    </>
  );
}
