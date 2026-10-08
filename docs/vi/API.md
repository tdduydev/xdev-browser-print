# SDK `@xdev/browser-print` — API

## Cài đặt

```bash
pnpm add @xdev/browser-print
```

Gói ESM + CJS, có type đầy đủ, không phụ thuộc backend. `react` là peer dependency tuỳ chọn (≥ 18, đã test với React 19).

## Khởi tạo và kết nối

```ts
import { XDevBrowserPrint } from '@xdev/browser-print';

const printer = new XDevBrowserPrint({
  extensionId: 'EXTENSION_ID',   // tuỳ chọn: chỉ nói chuyện với bản extension này
  scopes: ['read', 'print'],     // mặc định
  appName: 'HIS Bệnh viện',      // hiện trong cửa sổ duyệt
});

if (!(await printer.isInstalled())) {
  // Chưa cài extension, extension bị tắt, hoặc site chưa được cho phép.
}
await printer.connect(); // có thể mở cửa sổ duyệt của extension
```

| Tuỳ chọn | Mặc định | Ý nghĩa |
|---|---|---|
| `extensionId` | — | Bỏ qua extension khác trả lời trên trang. |
| `scopes` | `['read','print']` | Scope xin khi `connect()`. |
| `timeoutMs` | 10 000 | Thời gian chờ mỗi request. `print` dùng tối thiểu 30 000. |
| `detectTimeoutMs` | 1 500 | Thời gian chờ content script trả lời `isInstalled()`. |
| `connectTimeoutMs` | 130 000 | Thời gian chờ người dùng duyệt. |

## Phương thức

| Phương thức | Scope | Kết quả |
|---|---|---|
| `isInstalled()` | — | `true` khi bridge trả lời trên trang này. |
| `connect()` / `disconnect()` | — | `ConnectResult { extensionId, extensionVersion, protocolVersion, origin, scopes }` |
| `getStatus()` | read | `ExtensionStatus` |
| `getCapabilities()` | read | `Capabilities`: adapter nào có, định dạng, có cần hộp thoại không. |
| `getPrinters()` | read | `PublicPrinter[]`: các printer profile. **Không phải** danh sách máy in hệ điều hành. |
| `getMappings()` | read | `DocumentMapping[]` |
| `saveMapping(m)` / `deleteMapping(type)` | configure | Cần cài đặt `allowSiteConfigure = true`. |
| `print(options)` | print | `PublicJobStatus` (xem dưới). |
| `printPdf(documentType, data, options?)` | print | Gọi `print` với `format: 'PDF'`. |
| `printRaw(documentType, format, data, options?)` | print | `format` là `ESCPOS`, `ZPL`, `TSPL` hoặc `RAW`. |
| `getJobStatus(jobId)` / `cancelJob(jobId)` | print | `PublicJobStatus`. Chỉ huỷ được job `QUEUED` hoặc `WAITING_PERMISSION`. |
| `onStatusChanged(listener)` | — | Nhận event `job` và `status`. Trả hàm huỷ đăng ký. |
| `dispose()` | — | Gỡ listener. |

### `print(options)`

```ts
const job = await printer.print({
  documentType: 'PRESCRIPTION',
  format: 'PDF',             // PDF | HTML | ESCPOS | ZPL | TSPL | RAW
  data: pdfBlob,             // Blob | ArrayBuffer | Uint8Array | string
  copies: 1,                 // tuỳ chọn, ghi đè mapping
  printerId: 'printer-a5',   // tuỳ chọn, bỏ qua mapping
  idempotencyKey: `rx-${prescriptionId}`, // nên đặt theo chứng từ để retry an toàn
  wait: 'settled',           // 'accepted' trả về ngay khi job vào hàng đợi
});
```

- `data` kiểu `string`: với `PDF`/`RAW` là base64; với `HTML`/`ZPL`/`TSPL`/`ESCPOS` là văn bản.
- Kết quả `SUBMITTED`: thiết bị đã nhận đủ byte.
- Kết quả `UNKNOWN` + `PRINT_DIALOG_CLOSED`: hộp thoại in Chrome đã đóng. Chrome không cho biết người dùng bấm In hay Huỷ.
- Job `FAILED` hoặc `CANCELLED` → `print()` ném `PrintJobError` (có `error.job`).

## Lỗi

| Class | Mã lỗi |
|---|---|
| `NotInstalledError` | `NOT_INSTALLED` |
| `BrowserPrintTimeoutError` | `TIMEOUT` |
| `PermissionError` | `ORIGIN_NOT_ALLOWED`, `PERMISSION_DENIED`, `PAIRING_REJECTED` |
| `UnsupportedCapabilityError` | `UNSUPPORTED_CAPABILITY`, `UNSUPPORTED_FORMAT` |
| `PrintJobError` | `errorCode` của job, hoặc `JOB_CANCELLED` |
| `BrowserPrintError` (lớp cha) | Mọi mã khác: `INVALID_REQUEST`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `REPLAY_DETECTED`, `MAPPING_NOT_FOUND`, `PROFILE_NOT_FOUND`, `DEVICE_NOT_FOUND`, `DEVICE_BUSY`, `DEVICE_DISCONNECTED`, `TRANSFER_FAILED`, `JOB_NOT_FOUND`, `EXTENSION_DISCONNECTED`, `PRINT_WINDOW_CLOSED`, `INTERNAL_ERROR` |

## React

```tsx
import { useBrowserPrint } from '@xdev/browser-print/react';

function PrintButton({ pdf }: { pdf: Blob }) {
  const { state, connect, print, error } = useBrowserPrint({ appName: 'HIS' });
  if (state === 'not-installed') return <a href="https://chromewebstore.google.com/">Cài xDev Browser Print</a>;
  if (state !== 'connected') return <button onClick={connect}>Kết nối máy in</button>;
  return (
    <>
      <button onClick={() => print({ documentType: 'PRESCRIPTION', format: 'PDF', data: pdf })}>In đơn thuốc</button>
      {error && <p>{error.code}: {error.message}</p>}
    </>
  );
}
```

`state`: `detecting` → `ready` | `not-installed` → `connecting` → `connected` | `error`.

## Protocol (cho người tích hợp không dùng SDK)

Trang gửi `window.postMessage(envelope, location.origin)`:

```json
{ "channel": "xdev-browser-print", "dir": "to-ext", "kind": "request",
  "payload": { "requestId": "req_<32 hex>", "sentAt": 1760000000000, "method": "print", "params": { } } }
```

Content script trả `kind: "response" | "event" | "ready"` với `dir: "from-ext"`. Định nghĩa đầy đủ: `packages/shared-types/src/protocol.ts`.
