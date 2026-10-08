import { useCallback, useEffect, useState } from 'react';
import type { JobState, PrintConfig, PrintJobRecord } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import { t } from '../../ui/i18n';
import { useBroadcast } from '../../ui/useBackground';

const TONE: Partial<Record<JobState, string>> = { SUBMITTED: 'ok', FAILED: 'danger', CANCELLED: 'danger', UNKNOWN: 'warn' };

function size(n: number) {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function History({ config }: { config: PrintConfig }) {
  const [jobs, setJobs] = useState<PrintJobRecord[]>([]);
  const load = useCallback(() => void callBackground('jobs.list', { limit: 200 }).then(setJobs), []);
  useEffect(load, [load]);
  useBroadcast('broadcast.jobs', load);
  const name = (id?: string) => config.profiles.find((p) => p.id === id)?.name ?? id ?? '—';

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{t('history.title')}</h1>
        <button onClick={() => void callBackground('jobs.clear', {}).then(load)}>{t('history.clear')}</button>
      </div>
      {jobs.length === 0 ? (
        <p className="muted">{t('history.empty')}</p>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table data-testid="history-table">
            <thead>
              <tr>
                <th>{t('history.time')}</th>
                <th>{t('history.origin')}</th>
                <th>{t('history.doc')}</th>
                <th>{t('history.format')}</th>
                <th>{t('history.size')}</th>
                <th>{t('history.printer')}</th>
                <th>{t('history.state')}</th>
                <th>{t('history.outcome')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.jobId}>
                  <td>{new Date(j.createdAt).toLocaleString()}</td>
                  <td><code>{j.origin.startsWith('chrome-extension://') ? 'extension' : j.origin}</code></td>
                  <td><code>{j.documentType}</code></td>
                  <td>{j.format}</td>
                  <td>{size(j.sizeBytes)}</td>
                  <td>{name(j.profileId)}</td>
                  <td><span className={`badge ${TONE[j.state] ?? ''}`}>{j.state}</span></td>
                  <td className="muted">
                    {j.outcome}
                    {j.errorCode && <div>{j.errorCode}: {j.errorMessage}</div>}
                  </td>
                  <td>
                    {(j.state === 'QUEUED' || j.state === 'WAITING_PERMISSION') && (
                      <button onClick={() => void callBackground('jobs.cancel', { jobId: j.jobId })}>{t('history.cancel')}</button>
                    )}
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
