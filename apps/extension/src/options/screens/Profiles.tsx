import { useEffect, useState } from 'react';
import type { AdapterType, PrintConfig, PrinterCategory, PrinterProfile } from '@xdev/shared-types';
import { ADAPTER_TYPES, PRINTER_CATEGORIES, TEXT_ENCODINGS } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import { listSerial, listUsb, selectorKey, type GrantedDevice } from '../../lib/devices';
import { t, type I18nKey } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

const CATEGORY_DEFAULTS: Record<PrinterCategory, Partial<PrinterProfile>> = {
  A4: { paperSize: 'A4', adapter: 'browser', marginsMm: { top: 10, right: 10, bottom: 10, left: 10 } },
  A5: { paperSize: 'A5', adapter: 'browser', marginsMm: { top: 8, right: 8, bottom: 8, left: 8 } },
  K80: { paperSize: 'K80', adapter: 'webusb', marginsMm: { top: 0, right: 0, bottom: 0, left: 0 }, autoCut: true },
  K58: { paperSize: 'K58', adapter: 'webusb', marginsMm: { top: 0, right: 0, bottom: 0, left: 0 }, autoCut: true },
  BARCODE: { paperSize: '50x30', adapter: 'webusb', marginsMm: { top: 0, right: 0, bottom: 0, left: 0 }, barcodeDensity: 8 },
};

function blank(): PrinterProfile {
  return {
    id: '',
    name: '',
    adapter: 'browser',
    category: 'A4',
    paperSize: 'A4',
    orientation: 'portrait',
    copies: 1,
    marginsMm: { top: 10, right: 10, bottom: 10, left: 10 },
    encoding: 'ascii',
    autoCut: false,
    createdAt: 0,
    updatedAt: 0,
  };
}

export function Profiles({ config }: { config: PrintConfig }) {
  const [editing, setEditing] = useState<PrinterProfile | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const p of config.profiles) {
      void callBackground('profile.status', { id: p.id })
        .then((s) => setStatus((m) => ({ ...m, [p.id]: s.ready ? 'ok' : (s.reason ?? 'not-ready') })))
        .catch(() => undefined);
    }
  }, [config.profiles]);

  const remove = async (id: string) => {
    try {
      await callBackground('profile.delete', { id });
      setMsg({ ok: true, text: t('common.saved') });
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  };

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>{t('profiles.title')}</h1>
        <button className="primary" data-testid="profile-add" onClick={() => { setEditing(blank()); setIsNew(true); }}>
          {t('common.add')}
        </button>
      </div>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</div>}
      {editing && (
        <ProfileForm
          initial={editing}
          isNew={isNew}
          onDone={(text) => {
            setEditing(null);
            if (text) setMsg({ ok: true, text });
          }}
        />
      )}
      {config.profiles.length === 0 ? (
        <p className="muted">{t('profiles.empty')}</p>
      ) : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t('profiles.name')}</th>
                <th>{t('profiles.id')}</th>
                <th>{t('profiles.category')}</th>
                <th>{t('profiles.adapter')}</th>
                <th>{t('profiles.paperSize')}</th>
                <th>{t('profiles.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {config.profiles.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name} {p.isDefault && <span className="badge">default</span>}
                  </td>
                  <td><code>{p.id}</code></td>
                  <td>{p.category}</td>
                  <td>{p.adapter}</td>
                  <td>{p.paperSize}</td>
                  <td>
                    {status[p.id] === 'ok' ? (
                      <span className="badge ok">{t('profiles.ready')}</span>
                    ) : status[p.id] ? (
                      <span className="badge warn" title={status[p.id]}>{t('profiles.notReady')}</span>
                    ) : null}
                  </td>
                  <td className="row">
                    <button onClick={() => { setEditing(p); setIsNew(false); }}>{t('common.edit')}</button>
                    <button className="danger" onClick={() => void remove(p.id)}>{t('common.delete')}</button>
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

function ProfileForm({ initial, isNew, onDone }: { initial: PrinterProfile; isNew: boolean; onDone: (msg?: string) => void }) {
  const [p, setP] = useState<PrinterProfile>(initial);
  const [devices, setDevices] = useState<GrantedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PrinterProfile>(k: K, v: PrinterProfile[K]) => setP((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    void (p.adapter === 'webusb' ? listUsb() : p.adapter === 'webserial' ? listSerial() : Promise.resolve([])).then(setDevices);
  }, [p.adapter]);

  const changeCategory = (category: PrinterCategory) => setP((x) => ({ ...x, category, ...CATEGORY_DEFAULTS[category] }));

  const changeAdapter = (adapter: AdapterType) =>
    setP((x) => ({
      ...x,
      adapter,
      device: undefined,
      ...(adapter === 'webserial' && { serial: x.serial ?? { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' } }),
    }));

  const save = async () => {
    try {
      const profile: PrinterProfile = { ...p, id: p.id.trim(), name: p.name.trim() };
      if (profile.adapter !== 'webserial') delete profile.serial;
      if (profile.adapter === 'browser') delete profile.device;
      await callBackground('profile.upsert', { profile });
      onDone(t('common.saved'));
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="card" data-testid="profile-form">
      {error && <div className="notice error">{error}</div>}
      <div className="grid">
        <label>
          {t('profiles.id')}
          <input value={p.id} disabled={!isNew} onChange={(e) => set('id', e.target.value)} placeholder="printer-a5" data-testid="profile-id" />
        </label>
        <label>
          {t('profiles.name')}
          <input value={p.name} onChange={(e) => set('name', e.target.value)} data-testid="profile-name" />
        </label>
        <label>
          {t('profiles.category')}
          <select value={p.category} onChange={(e) => changeCategory(e.target.value as PrinterCategory)} data-testid="profile-category">
            {PRINTER_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          {t('profiles.adapter')}
          <select value={p.adapter} onChange={(e) => changeAdapter(e.target.value as AdapterType)} data-testid="profile-adapter">
            {ADAPTER_TYPES.map((a) => <option key={a} value={a}>{t(`profiles.adapter.${a}` as I18nKey)}</option>)}
          </select>
        </label>
        <label>
          {t('profiles.paperSize')}
          <input value={p.paperSize} onChange={(e) => set('paperSize', e.target.value)} placeholder="A4, A5, K80, K58, 50x30" />
        </label>
        <label>
          {t('profiles.paperWidth')}
          <input type="number" value={p.paperWidthMm ?? ''} onChange={(e) => set('paperWidthMm', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label>
          {t('profiles.paperHeight')}
          <input type="number" value={p.paperHeightMm ?? ''} onChange={(e) => set('paperHeightMm', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label>
          {t('profiles.orientation')}
          <select value={p.orientation} onChange={(e) => set('orientation', e.target.value as PrinterProfile['orientation'])}>
            <option value="portrait">{t('profiles.portrait')}</option>
            <option value="landscape">{t('profiles.landscape')}</option>
          </select>
        </label>
        <label>
          {t('profiles.copies')}
          <input type="number" min={1} max={20} value={p.copies} onChange={(e) => set('copies', Number(e.target.value))} />
        </label>
        <label>
          {t('profiles.encoding')}
          <select value={p.encoding} onChange={(e) => set('encoding', e.target.value as PrinterProfile['encoding'])}>
            {TEXT_ENCODINGS.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        {(p.category === 'K80' || p.category === 'K58') && (
          <label title={t('profiles.codePageHint')}>
            {t('profiles.codePage')}
            <input
              type="number"
              min={0}
              max={255}
              placeholder={t('profiles.codePageDefault')}
              value={p.escposCodePage ?? ''}
              onChange={(e) => set('escposCodePage', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </label>
        )}
        {p.category === 'BARCODE' && (
          <label>
            {t('profiles.density')}
            <select value={p.barcodeDensity ?? 8} onChange={(e) => set('barcodeDensity', Number(e.target.value) as PrinterProfile['barcodeDensity'])}>
              {[6, 8, 12, 24].map((d) => <option key={d} value={d}>{d} ({Math.round(d * 25.4)} dpi)</option>)}
            </select>
          </label>
        )}
        {p.adapter === 'webserial' && p.serial && (
          <label>
            {t('profiles.baud')}
            <select value={p.serial.baudRate} onChange={(e) => set('serial', { ...p.serial!, baudRate: Number(e.target.value) })}>
              {[9600, 19200, 38400, 57600, 115200].map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <span className="muted">{t('profiles.margins')}</span>
        {(['top', 'right', 'bottom', 'left'] as const).map((k) => (
          <input key={k} type="number" min={0} max={100} style={{ width: 70 }} aria-label={k} value={p.marginsMm[k]} onChange={(e) => set('marginsMm', { ...p.marginsMm, [k]: Number(e.target.value) })} />
        ))}
      </div>
      {p.adapter !== 'browser' && (
        <label style={{ marginBottom: 12 }}>
          {t('profiles.device')}
          {devices.length === 0 ? (
            <span className="muted">{t('profiles.noDevice')}</span>
          ) : (
            <select
              value={selectorKey(p.device)}
              onChange={(e) => set('device', devices.find((d) => d.key === e.target.value)?.selector)}
              data-testid="profile-device"
            >
              <option value="">{t('profiles.pickDevice')}</option>
              {devices.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          )}
        </label>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="check">
          <input type="checkbox" checked={p.autoCut} onChange={(e) => set('autoCut', e.target.checked)} /> {t('profiles.autoCut')}
        </label>
        <label className="check">
          <input type="checkbox" checked={!!p.isDefault} onChange={(e) => set('isDefault', e.target.checked)} /> {t('profiles.default')}
        </label>
      </div>
      <div className="row">
        <button className="primary" onClick={() => void save()} data-testid="profile-save">{t('common.save')}</button>
        <button onClick={() => onDone()}>{t('common.cancel')}</button>
      </div>
    </div>
  );
}
