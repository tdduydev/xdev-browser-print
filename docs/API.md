# SDK `@tdduydev/browser-print` — API

Vietnamese version: [vi/API.md](vi/API.md)

## Install

```bash
pnpm add @tdduydev/browser-print
```

ESM + CJS, fully typed, no backend dependency. `react` is an optional peer dependency (≥ 18, tested with React 19).

## Create and connect

```ts
import { XDevBrowserPrint } from '@tdduydev/browser-print';

const printer = new XDevBrowserPrint({
  extensionId: 'EXTENSION_ID',   // optional: only talk to this extension build
  scopes: ['read', 'print'],     // default
  appName: 'Hospital HIS',       // shown in the approval window
});

if (!(await printer.isInstalled())) {
  // Extension not installed, disabled, or this site is not allowed.
}
await printer.connect(); // may open the extension's approval window
```

| Option | Default | Meaning |
|---|---|---|
| `extensionId` | — | Ignore other extensions answering on the page. |
| `scopes` | `['read','print']` | Scopes requested by `connect()`. |
| `timeoutMs` | 10,000 | Per-request timeout. `print` uses at least 30,000. |
| `detectTimeoutMs` | 1,500 | How long `isInstalled()` waits for the content script. |
| `connectTimeoutMs` | 130,000 | How long to wait for the user's approval. |

## Methods

| Method | Scope | Result |
|---|---|---|
| `isInstalled()` | — | `true` when the bridge answers on this page. |
| `connect()` / `disconnect()` | — | `ConnectResult { extensionId, extensionVersion, protocolVersion, origin, scopes }` |
| `getStatus()` | read | `ExtensionStatus` |
| `getCapabilities()` | read | `Capabilities`: available adapters, formats, whether a dialog is needed. |
| `getPrinters()` | read | `PublicPrinter[]`: printer profiles. **Not** the OS printer list. |
| `getMappings()` | read | `DocumentMapping[]` |
| `saveMapping(m)` / `deleteMapping(type)` | configure | Requires the `allowSiteConfigure = true` setting. |
| `print(options)` | print | `PublicJobStatus` (see below). |
| `printPdf(documentType, data, options?)` | print | `print` with `format: 'PDF'`. |
| `printRaw(documentType, format, data, options?)` | print | `format` is `ESCPOS`, `ZPL`, `TSPL` or `RAW`. |
| `getJobStatus(jobId)` / `cancelJob(jobId)` | print | `PublicJobStatus`. Only `QUEUED` or `WAITING_PERMISSION` jobs can be cancelled. |
| `onStatusChanged(listener)` | — | Receives `job` and `status` events. Returns an unsubscribe function. |
| `dispose()` | — | Removes listeners. |

### `print(options)`

```ts
const job = await printer.print({
  documentType: 'PRESCRIPTION',
  format: 'PDF',             // PDF | HTML | ESCPOS | ZPL | TSPL | RAW
  data: pdfBlob,             // Blob | ArrayBuffer | Uint8Array | string
  copies: 1,                 // optional, overrides the mapping
  printerId: 'printer-a5',   // optional, bypasses the mapping
  idempotencyKey: `rx-${prescriptionId}`, // derive from the document so retries are safe
  wait: 'settled',           // 'accepted' returns as soon as the job is queued
});
```

- `data` as `string`: base64 for `PDF`/`RAW`; text for `HTML`/`ZPL`/`TSPL`/`ESCPOS`.
- `SUBMITTED`: the device accepted all bytes.
- `UNKNOWN` + `PRINT_DIALOG_CLOSED`: Chrome's print dialog closed. Chrome does not say whether the user printed or cancelled.
- A `FAILED` or `CANCELLED` job makes `print()` throw `PrintJobError` (with `error.job`).

### Building ESC/POS bytes

`EscPosBuilder` makes receipt bytes in the page, including a QR code. Send them as `ESCPOS`:

```ts
import { EscPosBuilder } from '@tdduydev/browser-print';

const bytes = new EscPosBuilder('cp1258', 52) // text encoding, then ESC t n (optional, vendor-specific)
  .align('center').bold(true).line('Phòng khám An Bình').bold(false)
  .align('left').line('Đơn thuốc #1024')
  .qr('https://example.com/rx/1024', { size: 6, ecc: 'M' })
  .feed(3).cut()
  .build();
await printer.print({ documentType: 'RECEIPT', format: 'ESCPOS', data: bytes });
```

- Text encodings: `ascii` (Vietnamese without diacritics, safe everywhere), `cp1258` (Windows-1258, needs the printer's WPC1258 code page; Epson's number is 52), `latin1`, `utf-8` (only printers whose firmware reads UTF-8).
- `qr()` uses Epson `GS ( k` model 2. Most ESC/POS clones support it; check yours with the extension's test receipt.
- Text sent as a string (not bytes) is encoded by the extension with the profile's **Text encoding** and **ESC/POS code page** instead.

## Errors

| Class | Codes |
|---|---|
| `NotInstalledError` | `NOT_INSTALLED` |
| `BrowserPrintTimeoutError` | `TIMEOUT` |
| `PermissionError` | `ORIGIN_NOT_ALLOWED`, `PERMISSION_DENIED`, `PAIRING_REJECTED` |
| `UnsupportedCapabilityError` | `UNSUPPORTED_CAPABILITY`, `UNSUPPORTED_FORMAT` |
| `PrintJobError` | The job's `errorCode`, or `JOB_CANCELLED` |
| `BrowserPrintError` (base class) | All other codes: `INVALID_REQUEST`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `REPLAY_DETECTED`, `MAPPING_NOT_FOUND`, `PROFILE_NOT_FOUND`, `DEVICE_NOT_FOUND`, `DEVICE_BUSY`, `DEVICE_DISCONNECTED`, `TRANSFER_FAILED`, `JOB_NOT_FOUND`, `EXTENSION_DISCONNECTED`, `PRINT_WINDOW_CLOSED`, `INTERNAL_ERROR` |

## React

```tsx
import { useBrowserPrint } from '@tdduydev/browser-print/react';

function PrintButton({ pdf }: { pdf: Blob }) {
  const { state, connect, print, error } = useBrowserPrint({ appName: 'HIS' });
  if (state === 'not-installed') return <a href="https://chromewebstore.google.com/">Install xDev Browser Print</a>;
  if (state !== 'connected') return <button onClick={connect}>Connect printer</button>;
  return (
    <>
      <button onClick={() => print({ documentType: 'PRESCRIPTION', format: 'PDF', data: pdf })}>Print prescription</button>
      {error && <p>{error.code}: {error.message}</p>}
    </>
  );
}
```

`state`: `detecting` → `ready` | `not-installed` → `connecting` → `connected` | `error`.

## Protocol (for integrators not using the SDK)

The page posts `window.postMessage(envelope, location.origin)`:

```json
{ "channel": "xdev-browser-print", "dir": "to-ext", "kind": "request",
  "payload": { "requestId": "req_<32 hex>", "sentAt": 1760000000000, "method": "print", "params": { } } }
```

The content script answers with `kind: "response" | "event" | "ready"` and `dir: "from-ext"`. Full definitions: `packages/shared-types/src/protocol.ts`.
