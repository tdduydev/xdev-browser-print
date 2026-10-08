# Feature design — xDev Browser Print

Doc version: 0.1.0 · Date: 2026-10-08 · Vietnamese version: [vi/ARCHITECTURE.md](vi/ARCHITECTURE.md)

This document describes the extension, the SDK and the technical decisions behind them. Chrome limitations, with sources, are in section 2. Test results are in [TESTING.md](TESTING.md).

## 1. Goals and scope

A ReactJS website sends print jobs through the SDK. The extension picks the printer from the document type, then prints. There is no backend, native app or cloud print service.

| Property | Value |
|---|---|
| Browser | Google Chrome ≥ 118 on Windows 10/11, macOS, Linux |
| Manifest | V3 |
| Formats | `PDF`, `HTML`, `ESCPOS`, `ZPL`, `TSPL`, `RAW` |
| Printer categories | `A4`, `A5`, `K80`, `K58`, `BARCODE` |
| Storage | `chrome.storage.local` (configuration), IndexedDB (job history, temporary payloads). `chrome.storage.sync` is never used. |

## 2. Chrome limitations (sourced)

| # | Limitation | Status | Design consequence |
|---|---|---|---|
| L1 | `chrome.printing` exists only on ChromeOS. | FACT | OS printers cannot be listed or selected on Windows/macOS/Linux. `getPrinters()` returns user-created **printer profiles**. |
| L2 | `window.print()` always opens the print dialog and cannot pick a printer. | FACT | PDF/HTML go through Chrome's print dialog. The user picks the printer there. |
| L3 | Chrome does not report whether the user clicked Print or Cancel. | FACT | PDF/HTML jobs end in `UNKNOWN` + `PRINT_DIALOG_CLOSED`. |
| L4 | The `--kiosk-printing` flag skips the dialog and prints to the OS default printer. | FACT on Windows. UNKNOWN on Linux. One vendor reports macOS is not supported. | A deployment choice made by an administrator. The extension never fakes it. |
| L5 | WebUSB is available in extension service workers since Chrome 118. `requestDevice()` cannot be called there. | FACT (Chrome docs) | Users grant devices on the options page. The service worker uses `getDevices()`. `minimum_chrome_version = 118`. |
| L6 | Web Serial in service workers. | UNKNOWN (MDN: Dedicated Workers only) | If the service worker has no `navigator.serial`, the job runs in the `print.html` helper window. |
| L7 | A match pattern without a port matches every port. | FACT (Chrome docs) | The service worker MUST compare the exact origin, port included. |
| L8 | `externally_connectable` only accepts a static URL list in the manifest. | FACT | `externally_connectable` is not used. Content scripts are registered dynamically per origin. |

## 3. Architecture

```
ReactJS app
  └─ @tdduydev/browser-print (SDK)                window.postMessage (same origin)
       └─ Content script (relay, no privileges)  chrome.runtime port "xdbp-bridge"
            └─ Service worker
                 ├─ PageApi        origin + scope checks, replay protection
                 ├─ JobManager     idempotency, rate limit, per-printer queue, retry
                 ├─ Router         documentType → mapping → printer profile
                 └─ Adapter registry
                      ├─ BrowserPrintAdapter → print.html window → Chrome print dialog
                      ├─ WebUsbPrintAdapter  → navigator.usb (in the service worker)
                      └─ WebSerialPrintAdapter → navigator.serial (service worker or print.html)
                                                     └─ Physical printer
```

| Component | Path | Responsibility |
|---|---|---|
| Shared types | `packages/shared-types/src` | Data types, error codes, protocol. The contract between SDK and extension. |
| Core | `packages/core/src` | Pure logic: origin checks, configuration, router, state machine, rate limit, replay guard, ESC/POS/ZPL/TSPL encoders, test PDF. |
| Service worker | `apps/extension/src/background` | Wires components, receives messages, manages sites and approval windows. |
| Content script | `apps/extension/src/content/index.ts` | Relays messages between page and service worker. Holds no privileges. |
| Print runner | `apps/extension/src/print` | Renders the document and opens the print dialog. Runs RAW jobs when the service worker lacks the API. |
| Admin UI | `apps/extension/src/options`, `popup`, `approve` | 8 admin screens, popup, approval window. |
| SDK | `packages/browser-print-sdk/src` | `XDevBrowserPrint` class, `useBrowserPrint` hook. |

## 4. Main flows

### 4.1 Allowing a website (pairing)

1. The user enters an origin on the **Websites** screen, or clicks **Allow this website** in the popup.
2. The extension page sends `sites.pending` to the service worker. Reason: the popup can close while Chrome shows the permission prompt.
3. The extension page calls `chrome.permissions.request` with the host's match pattern.
4. The service worker receives `permissions.onAdded` or `sites.add`. It stores a `SiteGrant` for the **exact origin** and calls `chrome.scripting.registerContentScripts`.
5. The service worker injects the content script into open tabs of that host.

Result: only allowed origins get a content script. The manifest declares no static `content_scripts`.

### 4.2 Connecting from the SDK (`connect()`)

1. The SDK posts `hello`. The content script answers `ready` with the `extensionId`.
2. The SDK sends `connect` with the scopes it needs.
3. If the grant already covers the scopes, the service worker answers immediately.
4. If scopes are missing, the service worker opens `approve.html`. The user allows or denies. With no answer after 2 minutes, the request is denied.
5. An origin with no grant that is denied → `PAIRING_REJECTED`.

### 4.3 Printing a document

1. The SDK converts binary data to base64 and sends `print` with an `idempotencyKey`.
2. The service worker checks origin, `print` scope, `requestId`, `sentAt`.
3. JobManager checks format and size, then looks up a job with the same `idempotencyKey`. On a match it returns the existing job with `duplicate: true` and does not print again.
4. JobManager checks the per-origin rate limit.
5. The router picks the printer profile in this order: `printerId` → mapping of `documentType` → compatible default profile.
6. The router rejects formats the adapter cannot carry. Example: `ZPL` to a `browser` printer → `UNSUPPORTED_FORMAT`.
7. JobManager stores the payload in IndexedDB, moves the job to `QUEUED` and returns the `jobId`.
8. JobManager writes `DISPATCHING` to IndexedDB **before** sending anything to the device.
9. The adapter prints. JobManager writes the final state and deletes the payload.
10. The SDK receives a `job` event. If events are lost, the SDK polls `getJobStatus` every 2 s.

## 5. Job states

| State | Meaning |
|---|---|
| `CREATED` | Job created. |
| `VALIDATING` | Checking data and routing. |
| `WAITING_PERMISSION` | The site has "Ask before every print" on. Waiting for the user. |
| `QUEUED` | Waiting in the printer's queue. No byte sent yet. |
| `DISPATCHING` | Sending to the device or the print dialog. |
| `SUBMITTED` | The device accepted all bytes (`BYTES_WRITTEN_TO_DEVICE` / `BYTES_WRITTEN_TO_PORT`). Does not mean paper came out. |
| `UNKNOWN` | Not known whether the job printed. Examples: `PRINT_DIALOG_CLOSED`, `INTERRUPTED_DURING_DISPATCH`, `DISPATCH_TIMEOUT`. |
| `FAILED` | The job failed. See `errorCode`. |
| `CANCELLED` | Cancelled before sending. |

There is no `COMPLETED` state. Reason: no source reliably reports that paper came out.

Valid transitions (`packages/core/src/job-machine.ts`):

```
CREATED → VALIDATING → QUEUED → DISPATCHING → SUBMITTED | UNKNOWN | FAILED
                    ↘ WAITING_PERMISSION → QUEUED | CANCELLED
QUEUED → CANCELLED
DISPATCHING → QUEUED   (retry only, and only when no byte was sent)
```

### 5.1 Retry and duplicate prevention

| Condition | Action |
|---|---|
| Error before any byte was sent (device not found, busy, port open failed) | Retry. At most 3 sends (2 retries). Wait 1 s before the 2nd, 3 s before the 3rd. |
| Some bytes sent, then an error | `FAILED` + `PARTIAL_TRANSFER`. No retry. |
| Adapter timed out or threw | `UNKNOWN`. No retry. |
| Service worker restart while the job is `QUEUED` | Continue sending. |
| Service worker restart while the job is `DISPATCHING` | `UNKNOWN` + `INTERRUPTED_DURING_DISPATCH`. Never resent. |
| Service worker restart while the print window is still open | Stay `DISPATCHING`. The print window reports later. |

Reason: a duplicated prescription or patient label does more harm than a missing one. The user can reprint manually.

Maximum wait per send: `browser` 15 min, `webusb` 60 s, `webserial` 60 s.

## 6. Adapters

Common interface (`apps/extension/src/adapters/types.ts`):

```ts
interface PrintAdapter {
  readonly id: AdapterType;
  isSupported(): Promise<boolean>;
  getCapabilities(): Promise<PrinterCapabilities>;
  print(request: PrintRequest): Promise<PrintResult>;
  getStatus(profile?: PrinterProfile): Promise<PrinterStatus>;
}
```

| Adapter | Formats | No dialog | Can target a printer | Runs in |
|---|---|---|---|---|
| `browser` | PDF, HTML | No (only with `--kiosk-printing`) | No, the user picks in the dialog | `print.html` window |
| `webusb` | ESCPOS, ZPL, TSPL, RAW | Yes | Yes (vendorId/productId/serialNumber) | Service worker. Helper window if the API is missing. |
| `webserial` | ESCPOS, ZPL, TSPL, RAW | Yes | Yes (usbVendorId/usbProductId/index) | Service worker if available, otherwise helper window |

### 6.1 BrowserPrintAdapter

- PDF: create a Blob URL in the extension page, load it in an iframe, call `print()` on the iframe.
- HTML: sanitize with DOMPurify. Render in an iframe with `sandbox="allow-same-origin allow-modals"` (no `allow-scripts`). Add an `@page` rule from the profile's paper size and margins.
- Copies: HTML repeats the content with page breaks. PDF copies cannot be preset; the print window shows the requested count for the user to set.
- The print window holds an `xdbp-keepalive` port and pings every 20 s, so the service worker stays alive while the user is in the dialog.
- Window closed before the dialog opened → `FAILED` + `PRINT_WINDOW_CLOSED`. Closed after the dialog opened → `UNKNOWN`.

### 6.2 WebUsbPrintAdapter

1. Find the granted device with `getDevices()`.
2. Open it. Select configuration 1 if none is selected.
3. Pick the printer-class interface (class 7) with a bulk OUT endpoint. If there is none, pick any interface with bulk OUT.
4. `claimInterface`. An error here → `DEVICE_BUSY` (the OS driver owns the interface).
5. Send data in 16 KB chunks.
6. Always `releaseInterface` and `close` in `finally`.

### 6.3 WebSerialPrintAdapter

1. Find the granted port with `getPorts()` by USB ids and index.
2. Open it with the profile's `baudRate`, `dataBits`, `stopBits`, `parity`, `flowControl`.
3. Write the data and wait for `writer.ready`.
4. Always close the port.

`InvalidStateError` on open → `DEVICE_BUSY`. Web Serial reports no byte count on failure, so an error after writing started → `PARTIAL_TRANSFER`, no retry.

### 6.4 Preparing RAW bytes

- Text is encoded with the profile's `encoding`: `utf-8`, `latin1` or `ascii`. With `ascii`, Vietnamese diacritics are removed (`Đơn thuốc` → `Don thuoc`).
- `ESCPOS` + `autoCut = true`: append a cut command if the data does not already end with `GS V`.
- `copies` > 1: repeat the whole payload.

## 7. Configuration

```json
{
  "schemaVersion": 1,
  "profiles": [{ "id": "printer-k80", "name": "Receipt printer", "adapter": "webusb", "category": "K80",
                 "paperSize": "K80", "orientation": "portrait", "copies": 1,
                 "marginsMm": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
                 "encoding": "ascii", "autoCut": true,
                 "device": { "kind": "usb", "vendorId": 1046, "productId": 20497 } }],
  "mappings": { "INVOICE": { "documentType": "INVOICE", "printerId": "printer-k80", "copies": 2 } },
  "settings": { "language": "vi", "maxJobBytes": 15728640, "rateLimitJobs": 20, "rateLimitWindowMs": 60000,
                "historyLimit": 500, "allowSiteConfigure": true, "allowLocalhost": true }
}
```

Validation rules (`packages/core/src/config.ts`):

| Field | Rule |
|---|---|
| `id` | `^[a-z0-9][a-z0-9_-]{0,63}$` |
| `documentType` | `^[A-Z][A-Z0-9_]{0,63}$` |
| `paperSize` | `A4`, `A5`, `K80`, `K58` or `<width>x<height>` in mm, e.g. `50x30` |
| `copies` | Integer 1–20 |
| `marginsMm` | 0–100 mm per side |
| `barcodeDensity` | 6, 8, 12, 24 dpmm |
| `device` | Required for `webusb` and `webserial` |
| `serial.baudRate` | 300–4,000,000 |

Each category has at most one default profile. A profile used by a mapping cannot be deleted. Corrupt stored configuration is dropped on read; the extension keeps working with the valid part.

## 8. Admin UI

| Screen | Purpose |
|---|---|
| Dashboard | Version, OS, number of sites, profiles, mappings, active jobs. Adapter capability table. Chrome limitations. |
| Printers | Add, edit, delete printer profiles. Readiness status. |
| Document mapping | Map a `documentType` to a profile; override paper size, orientation, copies. |
| Devices | Grant and revoke WebUSB and Web Serial access. |
| Test print | Test PDF, HTML, ESC/POS (K80/K58), ZPL, TSPL. |
| Print history | Job metadata: time, site, document type, format, size, printer, state. No document content. |
| Websites | Add origins, choose scopes, require confirmation per job, revoke. |
| Settings | Language (Vietnamese by default), size limit, rate limit, history size, allow sites to change mappings, allow localhost. |

## 9. Design decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Dynamically registered content scripts instead of `externally_connectable` | Origins are added at runtime. `externally_connectable` is static. | Needs a host permission per site. Pages opened before the grant need the script injected (done for open tabs). |
| All configuration writes go through a queue in the service worker | `chrome.storage` has no transactions. | Options pages send messages instead of writing directly. |
| Payloads live in IndexedDB and are deleted when the job ends | Chrome messages are JSON. The print window needs large files. | The payload is on disk while the job runs. |
| One queue per printer profile | Two jobs must never interleave bytes on one device. | Jobs on the same printer run one after another. |
| Site HTML is sanitized and shown in a sandboxed iframe | Site code must never run with extension privileges. | Scripts and forms in documents are dropped. Print documents MUST be static HTML. |
