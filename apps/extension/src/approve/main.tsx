import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Scope } from '@xdev/shared-types';
import type { ApprovalRequest } from '../background/approvals';
import { callBackground } from '../lib/messages';
import { loadLanguage, t, type I18nKey } from '../ui/i18n';
import '../ui/styles.css';

const id = new URLSearchParams(location.search).get('id') ?? '';
// Keep the worker (which holds the pending promise) alive while the user decides.
const keepAlive = chrome.runtime.connect({ name: 'xdbp-keepalive' });
setInterval(() => keepAlive.postMessage({ ping: Date.now() }), 20_000);

function Approve() {
  const [req, setReq] = useState<ApprovalRequest | null | undefined>(undefined);
  const [scopes, setScopes] = useState<Scope[]>([]);

  useEffect(() => {
    void loadLanguage()
      .then(() => callBackground('approval.get', { id }))
      .then((r) => {
        setReq(r);
        if (r?.kind === 'pair') setScopes(r.scopes);
      })
      .catch(() => setReq(null));
  }, []);

  const answer = async (approved: boolean) => {
    await callBackground('approval.respond', { id, answer: { approved, ...(approved && req?.kind === 'pair' && { scopes }) } }).catch(() => undefined);
    window.close();
  };

  if (req === undefined) return null;
  if (req === null) return <div className="approve"><p>{t('approve.expired')}</p></div>;

  return (
    <div className="approve">
      <div className="row">
        <img src="/icons/icon-48.png" width={32} height={32} alt="" />
        <h1 style={{ margin: 0 }}>{req.kind === 'pair' ? t('approve.pairTitle') : t('approve.jobTitle')}</h1>
      </div>
      <div className="card">
        <div className="muted">{t('approve.origin')}</div>
        <p><code data-testid="approve-origin">{req.kind === 'pair' ? req.origin : req.job.origin}</code></p>
        {req.kind === 'pair' && req.appName && (
          <>
            <div className="muted">{t('approve.app')}</div>
            <p>{req.appName}</p>
          </>
        )}
        {req.kind === 'pair' ? (
          <>
            <div className="muted">{t('approve.scopes')}</div>
            {req.scopes.map((s) => (
              <label key={s} className="check">
                <input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s]))} />
                {t(`sites.scope.${s}` as I18nKey)}
              </label>
            ))}
          </>
        ) : (
          <table>
            <tbody>
              <tr><th>{t('history.doc')}</th><td><code>{req.job.documentType}</code></td></tr>
              <tr><th>{t('history.format')}</th><td>{req.job.format}</td></tr>
              <tr><th>{t('history.printer')}</th><td>{req.job.printerName}</td></tr>
              <tr><th>{t('history.size')}</th><td>{Math.ceil(req.job.sizeBytes / 1024)} KB</td></tr>
            </tbody>
          </table>
        )}
      </div>
      <p className="muted">{t('approve.warn')}</p>
      <div className="row">
        <button className="primary" data-testid="approve-allow" disabled={req.kind === 'pair' && !scopes.length} onClick={() => void answer(true)}>{t('approve.allow')}</button>
        <button data-testid="approve-deny" onClick={() => void answer(false)}>{t('approve.deny')}</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Approve />
  </StrictMode>,
);
