import { useState } from 'react';
import type { PrintConfig } from '@xdev/shared-types';
import { callBackground, type TestKind } from '../../lib/messages';
import { t, type I18nKey } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

export function TestPrint({ config }: { config: PrintConfig }) {
  const [profileId, setProfileId] = useState(config.profiles[0]?.id ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const profile = config.profiles.find((p) => p.id === profileId);
  const kinds: TestKind[] = profile?.adapter === 'browser' ? ['pdf', 'html'] : ['escpos', 'zpl', 'tspl'];

  const run = async (kind: TestKind) => {
    try {
      const r = await callBackground('test.print', { profileId, kind });
      setMsg({ ok: true, text: t('test.sent', { jobId: r.jobId }) });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };

  return (
    <>
      <h1>{t('test.title')}</h1>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'error'}`} data-testid="test-msg">{msg.text}</div>}
      {!config.profiles.length ? (
        <p className="muted">{t('mappings.needProfile')}</p>
      ) : (
        <div className="card">
          <label style={{ maxWidth: 360, marginBottom: 12 }}>
            {t('test.pick')}
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} data-testid="test-profile">
              {config.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.adapter} · {p.paperSize}</option>)}
            </select>
          </label>
          <div className="row">
            {kinds.map((k) => (
              <button key={k} className="primary" onClick={() => void run(k)} data-testid={`test-${k}`}>
                {t(`test.${k}` as I18nKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
