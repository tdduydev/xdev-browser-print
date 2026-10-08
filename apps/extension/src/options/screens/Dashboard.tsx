import { useCallback, useEffect, useState } from 'react';
import { callBackground, type DashboardStatus } from '../../lib/messages';
import { t } from '../../ui/i18n';
import { useBroadcast } from '../../ui/useBackground';

export function Dashboard() {
  const [s, setS] = useState<DashboardStatus | null>(null);
  const load = useCallback(() => void callBackground('status.get', {}).then(setS), []);
  useEffect(load, [load]);
  useBroadcast('broadcast.jobs', load);
  useBroadcast('broadcast.config', load);
  if (!s) return null;
  return (
    <>
      <h1>{t('nav.dashboard')}</h1>
      <div className="grid" style={{ marginBottom: 16 }}>
        {[
          [t('dash.version'), s.version],
          [t('dash.platform'), s.platform],
          [t('dash.sites'), s.sites],
          [t('dash.profiles'), s.profiles],
          [t('dash.mappings'), s.mappings],
          [t('dash.active'), s.activeJobs],
        ].map(([k, v]) => (
          <div className="card" key={String(k)}>
            <div className="muted">{k}</div>
            <div className="stat">{v}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>{t('dash.capabilities')}</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              {s.capabilities.adapters.map((a) => (
                <tr key={a.adapter}>
                  <td><strong>{a.adapter}</strong></td>
                  <td>{a.formats.join(', ')}</td>
                  <td>
                    <span className={`badge ${a.silent ? 'ok' : 'warn'}`}>{a.silent ? t('dash.silent') : t('dash.dialog')}</span>
                  </td>
                  <td className="muted">{a.notes.join(' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h2>{t('dash.limits')}</h2>
        <ul>
          <li>{t('dash.limit1')}</li>
          <li>{t('dash.limit2')}</li>
          <li>{t('dash.limit3')}</li>
        </ul>
      </div>
    </>
  );
}
