import type { AdapterCapability, Capabilities } from '@xdev/shared-types';
import { PROTOCOL_VERSION } from '@xdev/shared-types';

export async function computeCapabilities(): Promise<Capabilities> {
  const platform = (await chrome.runtime.getPlatformInfo()).os;
  const swUsb = 'usb' in navigator;
  const swSerial = 'serial' in navigator;
  const adapters: AdapterCapability[] = [
    {
      adapter: 'browser',
      available: true,
      formats: ['PDF', 'HTML'],
      silent: false,
      selectPrinter: false,
      notes: [
        'Uses the Chrome print preview; the user selects the OS printer.',
        'Dialog-free printing only when Chrome is started with --kiosk-printing (prints to the OS default printer).',
        'Chrome reports no print completion; jobs end as UNKNOWN/PRINT_DIALOG_CLOSED.',
      ],
    },
    {
      adapter: 'webusb',
      available: true,
      formats: ['ESCPOS', 'ZPL', 'TSPL', 'RAW'],
      silent: true,
      selectPrinter: true,
      notes: [
        swUsb ? 'Runs in the service worker.' : 'Runs in a small helper window (no WebUSB in this service worker).',
        'Only for devices granted on the Devices screen; the OS printer driver must not own the USB interface.',
      ],
    },
    {
      adapter: 'webserial',
      available: true,
      formats: ['ESCPOS', 'ZPL', 'TSPL', 'RAW'],
      silent: true,
      selectPrinter: true,
      notes: [
        swSerial ? 'Runs in the service worker.' : 'Runs in a small helper window (no Web Serial in service workers).',
        'Only for ports granted on the Devices screen.',
      ],
    },
  ];
  return {
    extensionVersion: chrome.runtime.getManifest().version,
    protocolVersion: PROTOCOL_VERSION,
    platform,
    adapters,
    chromePrintingApi: typeof (chrome as unknown as { printing?: unknown }).printing !== 'undefined',
    osPrinterEnumeration: false,
  };
}
