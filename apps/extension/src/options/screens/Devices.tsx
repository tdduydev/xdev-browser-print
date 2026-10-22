import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { PrintConfig } from '@xdev/shared-types';
import { callBackground } from '../../lib/messages';
import {
  hasSerial,
  hasUsb,
  listSerial,
  listUsb,
  profileForDevice,
  requestSerial,
  requestUsb,
  selectorKey,
  watchDevices,
  type GrantedDevice,
} from '../../lib/devices';
import { t } from '../../ui/i18n';
import { TestResult } from '../../ui/TestResult';
import { errorText } from '../../ui/useBackground';
import { defaultTestKind, useTestPrint } from '../../ui/useTestPrint';

export function Devices({ config }: { config: PrintConfig }) {
  const [usb, setUsb] = useState<GrantedDevice[]>([]);
  const [serial, setSerial] = useState<GrantedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { state, run } = useTestPrint();
  const load = useCallback(() => {
    void listUsb().then(setUsb);
    void listSerial().then(setSerial);
  }, []);
  useEffect(() => {
    load();
    return watchDevices(load);
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      setError(null);
      await fn();
    } catch (e) {
      // NotFoundError = user closed the chooser; not an error worth showing.
      if (!(e instanceof DOMException && e.name === 'NotFoundError')) setError(errorText(e));
    }
    load();
  };

  const createProfile = (d: GrantedDevice) =>
    act(() => callBackground('profile.upsert', { profile: profileForDevice(d, config.profiles.map((p) => p.id)) }));

  const row = (d: GrantedDevice) => {
    const profiles = config.profiles.filter((p) => selectorKey(p.device) === d.key);
    return (
      <tr key={d.key} data-testid={`device-${d.key}`}>
        <td>
          {d.label}
          <div className="muted">{profiles.length ? t('devices.usedBy', { names: profiles.map((p) => p.name).join(', ') }) : t('devices.noProfile')}</div>
        </td>
        <td style={{ width: 1, whiteSpace: 'nowrap' }}>
          {profiles.map((p) => (
            <button key={p.id} className="primary" disabled={state?.phase === 'running'} onClick={() => void run(p.id, defaultTestKind(p))} data-testid={`device-test-${p.id}`}>
              {profiles.length > 1 ? t('devices.testNamed', { name: p.name }) : t('devices.test')}
            </button>
          ))}
          {!profiles.length && (
            <button className="primary" onClick={() => void createProfile(d)} data-testid="device-create">
              {t('devices.createProfile', { category: d.category })}
            </button>
          )}{' '}
          {d.forget && <button className="danger" onClick={() => void act(d.forget!)}>{t('devices.forget')}</button>}
        </td>
      </tr>
    );
  };

  const section = (title: string, supported: boolean, list: GrantedDevice[], actions: ReactNode) => (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{title}</h2>
        <div className="row">{actions}</div>
      </div>
      {!supported ? (
        <p className="muted">{t('devices.unsupported')}</p>
      ) : list.length === 0 ? (
        <p className="muted">{t('devices.none')}</p>
      ) : (
        <table>
          <tbody>{list.map(row)}</tbody>
        </table>
      )}
    </div>
  );

  return (
    <>
      <h1>{t('devices.title')}</h1>
      <p className="muted">{t('devices.hint')}</p>
      <p className="muted">{t('devices.detectHint')}</p>
      {error && <div className="notice error">{error}</div>}
      <TestResult state={state} />
      {section(
        t('devices.usb'),
        hasUsb(),
        usb,
        <>
          <button className="primary" disabled={!hasUsb()} onClick={() => void act(() => requestUsb(true))} data-testid="devices-find-usb">
            {t('devices.findUsb')}
          </button>
          <button disabled={!hasUsb()} onClick={() => void act(() => requestUsb())}>{t('devices.addUsb')}</button>
        </>,
      )}
      {section(
        t('devices.serial'),
        hasSerial(),
        serial,
        <button className="primary" disabled={!hasSerial()} onClick={() => void act(requestSerial)}>{t('devices.addSerial')}</button>,
      )}
    </>
  );
}
