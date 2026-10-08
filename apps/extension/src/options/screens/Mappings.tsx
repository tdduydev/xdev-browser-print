import { useState } from 'react';
import type { Orientation, PrintConfig } from '@xdev/shared-types';
import { WELL_KNOWN_DOCUMENT_TYPES } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import { t } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

export function Mappings({ config }: { config: PrintConfig }) {
  const [docType, setDocType] = useState('');
  const [printerId, setPrinterId] = useState(config.profiles[0]?.id ?? '');
  const [copies, setCopies] = useState('');
  const [paperSize, setPaperSize] = useState('');
  const [orientation, setOrientation] = useState<Orientation | ''>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!config.profiles.length) return (<><h1>{t('mappings.title')}</h1><p className="muted">{t('mappings.needProfile')}</p></>);

  const save = async () => {
    try {
      await callBackground('mapping.save', {
        params: {
          documentType: docType.trim().toUpperCase(),
          printerId,
          ...(copies && { copies: Number(copies) }),
          ...(paperSize && { paperSize }),
          ...(orientation && { orientation }),
        },
      });
      setMsg({ ok: true, text: t('common.saved') });
      setDocType('');
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };

  const name = (id: string) => config.profiles.find((p) => p.id === id)?.name ?? id;
  const mappings = Object.values(config.mappings).sort((a, b) => a.documentType.localeCompare(b.documentType));

  return (
    <>
      <h1>{t('mappings.title')}</h1>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      <div className="card">
        <div className="grid">
          <label>
            {t('mappings.docType')}
            <input list="doc-types" value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="PRESCRIPTION" data-testid="mapping-doctype" />
            <datalist id="doc-types">
              {WELL_KNOWN_DOCUMENT_TYPES.map((d) => <option key={d} value={d} />)}
            </datalist>
          </label>
          <label>
            {t('mappings.printer')}
            <select value={printerId} onChange={(e) => setPrinterId(e.target.value)} data-testid="mapping-printer">
              {config.profiles.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </label>
          <label>
            {t('profiles.copies')} – {t('mappings.override')}
            <input type="number" min={1} max={20} value={copies} onChange={(e) => setCopies(e.target.value)} />
          </label>
          <label>
            {t('profiles.paperSize')} – {t('mappings.override')}
            <input value={paperSize} onChange={(e) => setPaperSize(e.target.value)} placeholder="A5" />
          </label>
          <label>
            {t('profiles.orientation')} – {t('mappings.override')}
            <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation | '')}>
              <option value="">—</option>
              <option value="portrait">{t('profiles.portrait')}</option>
              <option value="landscape">{t('profiles.landscape')}</option>
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" disabled={!docType.trim()} onClick={() => void save()} data-testid="mapping-save">{t('common.save')}</button>
        </div>
      </div>
      {mappings.length === 0 ? (
        <p className="muted">{t('mappings.empty')}</p>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t('mappings.docType')}</th>
                <th>{t('mappings.printer')}</th>
                <th>{t('mappings.override')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.documentType}>
                  <td><code>{m.documentType}</code></td>
                  <td>{name(m.printerId)}</td>
                  <td className="muted">{[m.paperSize, m.orientation, m.copies && `×${m.copies}`].filter(Boolean).join(' · ')}</td>
                  <td>
                    <button className="danger" onClick={() => void callBackground('mapping.delete', { documentType: m.documentType })}>{t('common.delete')}</button>
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
