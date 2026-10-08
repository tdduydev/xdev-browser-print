import { useCallback, useEffect, useState } from 'react';
import { hasSerial, hasUsb, listSerial, listUsb, requestSerial, requestUsb, type GrantedDevice } from '../../lib/devices';
import { t } from '../../ui/i18n';
import { errorText } from '../../ui/useBackground';

export function Devices() {
  const [usb, setUsb] = useState<GrantedDevice[]>([]);
  const [serial, setSerial] = useState<GrantedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    void listUsb().then(setUsb);
    void listSerial().then(setSerial);
  }, []);
  useEffect(load, [load]);

  const act = async (fn: () => Promise<void>) => {
    try {
      setError(null);
      await fn();
    } catch (e) {
      // NotFoundError = user closed the chooser; not an error worth showing.
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) setError(errorText(e));
    }
    load();
  };

  const section = (title: string, supported: boolean, list: GrantedDevice[], add: () => Promise<void>, addLabel: string) => (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{title}</h2>
        <button className="primary" disabled={!supported} onClick={() => void act(add)}>{addLabel}</button>
      </div>
      {!supported ? (
        <p className="muted">{t('devices.unsupported')}</p>
      ) : list.length === 0 ? (
        <p className="muted">{t('devices.none')}</p>
      ) : (
        <table>
          <tbody>
            {list.map((d) => (
              <tr key={d.key}>
                <td>{d.label}</td>
                <td style={{ width: 1 }}>
                  {d.forget && <button className="danger" onClick={() => void act(d.forget!)}>{t('devices.forget')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <h1>{t('devices.title')}</h1>
      <p className="muted">{t('devices.hint')}</p>
      {error && <div className="notice error">{error}</div>}
      {section(t('devices.usb'), hasUsb(), usb, requestUsb, t('devices.addUsb'))}
      {section(t('devices.serial'), hasSerial(), serial, requestSerial, t('devices.addSerial'))}
    </>
  );
}
