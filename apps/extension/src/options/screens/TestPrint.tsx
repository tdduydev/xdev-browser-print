import { useState } from 'react';
import type { PrintConfig } from '@xdev/shared-types';
import { t, type I18nKey } from '../../ui/i18n';
import { TestResult } from '../../ui/TestResult';
import { testKinds, useTestPrint } from '../../ui/useTestPrint';

export function TestPrint({ config }: { config: PrintConfig }) {
  const [profileId, setProfileId] = useState(config.profiles[0]?.id ?? '');
  const { state, run } = useTestPrint();
  const profile = config.profiles.find((p) => p.id === profileId);

  return (
    <>
      <h1>{t('test.title')}</h1>
      <TestResult state={state} />
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
            {testKinds(profile).map((k) => (
              <button key={k} className="primary" disabled={state?.phase === 'running'} onClick={() => void run(profileId, k)} data-testid={`test-${k}`}>
                {t(`test.${k}` as I18nKey)}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
