import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { normalizeOrigin } from '@xdev/core';
import { allowSite } from '../lib/site-permission';
import { callBackground } from '../lib/messages';
import { t } from '../ui/i18n';
import { TestResult } from '../ui/TestResult';
import { errorText, useConfig } from '../ui/useBackground';
import { defaultTestKind, useTestPrint } from '../ui/useTestPrint';
import '../ui/styles.css';

function Popup() {
  const { data } = useConfig();
  const [origin, setOrigin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState('');
  const { state, run } = useTestPrint();

  useEffect(() => {
    // activeTab exposes the URL of the tab the user opened the popup on, nothing else.
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      try {
        setOrigin(tab?.url ? new URL(tab.url).origin : null);
      } catch {
        setOrigin(null);
      }
    });
  }, []);

  if (!data) return null;
  let pairable: string | null = null;
  try {
    pairable = origin ? normalizeOrigin(origin, data.config.settings) : null;
  } catch {
    pairable = null;
  }
  const grant = pairable ? data.sites.find((s) => s.origin === pairable) : undefined;
  const profiles = data.config.profiles;
  const testProfile = profiles.find((p) => p.id === profileId) ?? profiles.find((p) => p.isDefault) ?? profiles[0];

  return (
    <div className="popup">
      <div className="row">
        <img src="/icons/icon-32.png" width={24} height={24} alt="" />
        <strong>{t('app.name')}</strong>
      </div>
      <div className="card" style={{ margin: 0 }}>
        <div className="muted">{t('popup.thisSite')}</div>
        {pairable ? (
          <>
            <p><code>{pairable}</code></p>
            {grant ? (
              <>
                <span className="badge ok">{t('popup.allowed')} · {grant.scopes.join(', ')}</span>
                <p><button className="danger" onClick={() => callBackground('sites.remove', { origin: pairable! }).catch((e: unknown) => setError(errorText(e)))}>{t('sites.remove')}</button></p>
              </>
            ) : (
              <>
                <p><span className="badge warn">{t('popup.notAllowed')}</span></p>
                <button
                  className="primary"
                  onClick={() => allowSite(pairable!, ['read', 'print'], false, data.config.settings).catch((e: unknown) => setError(errorText(e)))}
                >
                  {t('popup.allow')}
                </button>
              </>
            )}
          </>
        ) : (
          <p className="muted">{t('popup.unsupportedPage')}</p>
        )}
        {error && <div className="notice error" style={{ marginTop: 8 }}>{error}</div>}
      </div>
      <div className="card" style={{ margin: 0 }}>
        <div className="muted">{t('popup.test')}</div>
        {testProfile ? (
          <>
            <select value={testProfile.id} onChange={(e) => setProfileId(e.target.value)} aria-label={t('test.pick')} data-testid="popup-test-profile">
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p>
              <button className="primary" disabled={state?.phase === 'running'} onClick={() => void run(testProfile.id, defaultTestKind(testProfile))} data-testid="popup-test">
                {t('popup.testButton')}
              </button>
            </p>
            <TestResult state={state} />
          </>
        ) : (
          <p className="muted">{t('popup.noProfiles')}</p>
        )}
      </div>
      <div className="row muted">
        {t('dash.profiles')}: {data.config.profiles.length} · {t('dash.mappings')}: {Object.keys(data.config.mappings).length}
      </div>
      <button onClick={() => void chrome.runtime.openOptionsPage()}>{t('popup.openOptions')}</button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
