import { useState } from 'react';
import type { PrintConfig, Scope, SiteGrant } from '@xdev/shared-types';
import { SCOPES } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import { allowSite } from '../../lib/site-permission';
import { t, type I18nKey } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

export function Sites({ sites, config }: { sites: SiteGrant[]; config: PrintConfig }) {
  const [origin, setOrigin] = useState('');
  const [scopes, setScopes] = useState<Scope[]>(['read', 'print']);
  const [confirmEach, setConfirmEach] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const available = SCOPES.filter((s) => s !== 'configure' || config.settings.allowSiteConfigure);

  const add = () => {
    allowSite(origin, scopes, confirmEach, config.settings)
      .then(() => {
        setMsg({ ok: true, text: t('common.saved') });
        setOrigin('');
      })
      .catch((e: unknown) => setMsg({ ok: false, text: errorText(e) }));
  };

  const toggle = (list: Scope[], s: Scope) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  return (
    <>
      <h1>{t('sites.title')}</h1>
      <p className="muted">{t('sites.note')}</p>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <div className="card">
        <div className="row">
          <input style={{ flex: '1 1 320px' }} value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder={t('sites.origin')} aria-label={t('sites.origin')} data-testid="site-origin" />
          {available.map((s) => (
            <label key={s} className="check">
              <input type="checkbox" checked={scopes.includes(s)} onChange={() => setScopes(toggle(scopes, s))} /> {t(`sites.scope.${s}` as I18nKey)}
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={confirmEach} onChange={(e) => setConfirmEach(e.target.checked)} /> {t('sites.confirm')}
          </label>
          <button className="primary" disabled={!origin.trim()} onClick={add} data-testid="site-add">{t('sites.add')}</button>
        </div>
      </div>
      {sites.length === 0 ? (
        <p className="muted">{t('sites.empty')}</p>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <tbody>
              {sites.map((s) => (
                <tr key={s.origin}>
                  <td><code>{s.origin}</code></td>
                  <td className="row">
                    {available.map((sc) => (
                      <label key={sc} className="check">
                        <input type="checkbox" checked={s.scopes.includes(sc)} onChange={() => void callBackground('sites.update', { origin: s.origin, scopes: toggle(s.scopes, sc) })} />
                        {t(`sites.scope.${sc}` as I18nKey)}
                      </label>
                    ))}
                  </td>
                  <td>
                    <label className="check">
                      <input type="checkbox" checked={!!s.confirmEachJob} onChange={(e) => void callBackground('sites.update', { origin: s.origin, confirmEachJob: e.target.checked })} />
                      {t('sites.confirm')}
                    </label>
                  </td>
                  <td>
                    <button className="danger" onClick={() => void callBackground('sites.remove', { origin: s.origin })}>{t('sites.remove')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
