# Manual test checklist (BP-13)

Vietnamese version: [vi/MANUAL-TEST.md](vi/MANUAL-TEST.md)

Run this checklist on real machines and printers. A device is promoted to **Verified on Physical Printer** in [COMPATIBILITY.md](COMPATIBILITY.md) only with a filled record (see the end) and photos of the printout. Mock or headless results do not count.

Conventions:

- Result is `PASS`, `FAIL` or `N/A`. A `FAIL` becomes its own bug task; do not fix code during the test run.
- UI labels are written as **English label** (*Vietnamese label*). The admin UI language is set in **Settings → Language** (*Cài đặt → Ngôn ngữ*); the default is Vietnamese.
- Job results are read in two places: the value returned in the DevTools console (Appendix A) and **Print history** (*Lịch sử in*), columns **State** (*Trạng thái*) and **Outcome** (*Kết quả*, which also shows `errorCode: message`).
- A job state is one of `SUBMITTED`, `UNKNOWN`, `FAILED`, `CANCELLED` (final) or `CREATED`, `VALIDATING`, `WAITING_PERMISSION`, `QUEUED`, `DISPATCHING` (in progress). `SUBMITTED` means the device or port accepted the bytes, not that paper came out.
- There is no SDK test page with sample documents. Cases use either the admin **Test print** (*In thử*) screen or the console helper and sample payloads in the appendices.

## Setup (all groups)

- **S1.** Install the extension (unpacked or release zip). The admin UI opens on first install; otherwise open it from the toolbar popup, **Open admin page** (*Mở trang quản trị*). In `chrome://extensions` confirm the service worker is active. Note the version shown on **Dashboard** (*Tổng quan*).
- **S2.** Allow the test website (any page on a real `https` origin you control): **Websites** (*Website*) → type the exact origin → tick **Read configuration** (*Đọc cấu hình*) and **Print** (*In*) → **Allow website** (*Cho phép website*) → accept Chrome's permission prompt. The origin appears in the list. (This flow is itself tested in PM-01.)
- **S3.** Note OS, Chrome version, printer model, firmware and driver for the record.
- **S4.** Create printer profiles in **Printers** (*Máy in*) → **Add** (*Thêm*), then map document types in **Document mapping** (*Gán chứng từ*). Picking a **Printer type** (*Loại máy in*) fills its defaults (connection, paper size, margins; K80/K58 also turn on **Auto cut**). Every new profile starts with **Text encoding** (*Mã hoá ký tự*) = `ascii`. USB and serial profiles need a granted device first (EP-01 / WS-01).

  | Profile ID | Printer type | Connection | Paper size | Notes | Mapped document type |
  |---|---|---|---|---|---|
  | `printer-a5` | A5 | Chrome print dialog (PDF/HTML) | `A5` | margins 8 mm (default) | `PRESCRIPTION` |
  | `printer-a4` | A4 | Chrome print dialog (PDF/HTML) | `A4` | margins 10 mm (default) | `INVOICE` |
  | `printer-k80` | K80 | WebUSB (RAW commands) | `K80` | device from EP-01, Auto cut on | `RECEIPT` |
  | `printer-k58` | K58 | WebUSB (RAW commands) | `K58` | device from EP-01, Auto cut on | `RECEIPT_K58` |
  | `printer-label` | BARCODE | WebUSB (RAW commands) | `50x30` | **Dot density** (*Mật độ điểm*) matching the printer (8 = 203 dpi) | `SPECIMEN_LABEL` |
  | `printer-serial` | K80 or BARCODE | Web Serial (RAW commands) | as the printer | device and **Baud rate** from WS-01 | `SERIAL_TEST` |

- **S5.** Open DevTools on a page of the allowed site and paste the helper from Appendix A. Run `await xp('connect', { scopes: ['read', 'print'], sdkVersion: 'manual' })`; it must return the origin and scopes `["read","print"]`.

## 1. Print dialog (device: any office printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| PD-01 | S1–S5, printer installed in the OS, `printer-a5` mapped to `PRESCRIPTION` | Quick check: **Test print** → choose `printer-a5` → **Test HTML** (*In thử HTML*). Then send the A5 prescription from Appendix B.1 (`print` with `format: 'HTML'`, `documentType: 'PRESCRIPTION'`; paper size comes from the profile, there is no paper option in `print()`). | A print window opens and then Chrome's dialog. The preview is A5 (148×210 mm), content not clipped, margins 8 mm, Vietnamese text correct, page count as expected, paper matches the preview |
| PD-02 | Same, `printer-a4` mapped to `INVOICE` | Quick check: **Test print** → `printer-a4` → **Test PDF** (*In thử PDF*) (one A4 page, generated text, no diacritics). Then send a real multi-page A4 PDF invoice with Appendix B.2 (`documentType: 'INVOICE'`) | Dialog shows A4, all pages present, fonts render as in the source PDF, paper matches. The PDF's own page size is used; the profile's paper size and margins are not applied to PDFs |
| PD-03 | Same | (a) Send PD-01 content and press **Cancel** in the dialog. (b) Send it again and close the small print window ("Printing – xDev Browser Print") as soon as it appears, before the dialog shows | (a) Job ends `UNKNOWN`, outcome `PRINT_DIALOG_CLOSED`; the print window closes itself about 1.5 s later; `xprint` resolves (no error). (b) Job ends `FAILED`, outcome and `errorCode` `PRINT_WINDOW_CLOSED`. If the dialog had already opened, the job ends `UNKNOWN` with outcome `PRINT_WINDOW_CLOSED`; record which one happened |
| PD-04 | Same | Send PD-01 content, choose the printer and print | Paper comes out. Job ends `UNKNOWN`, outcome `PRINT_DIALOG_CLOSED` (the same as cancel: Chrome does not report whether the user printed). No leftover window |
| PD-05 | Same | Send Appendix B.3 (HTML with `<script>`, an inline `onclick` and a remote `<img>`) as `PRESCRIPTION` | Script does not run (no `alert`, title text unchanged); the page still prints. Record whether the remote image loads and appears in the preview |

## 2. `--kiosk-printing` (device: Windows machine + default printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| KP-01 | Chrome fully closed (no background process), default OS printer set | Start Chrome with `--kiosk-printing`, send PD-01 content (or **Test HTML** on `printer-a5`) | No dialog; prints on the default printer. Record the job state and outcome (code expects `UNKNOWN` / `PRINT_DIALOG_CLOSED`) |
| KP-02 | Same | Change the default printer, restart Chrome with the flag, repeat | Prints on the new default printer |
| KP-03 | macOS/Linux (optional) | Repeat KP-01 | Record whether it works; the matrix currently says UNKNOWN |

## 3. WebUSB ESC/POS (device: K80 and K58 USB thermal printers)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| EP-01 | Printer on USB; on Windows the WinUSB driver is installed, on Linux udev rule set and `usblp` unbound | 1. **Devices** (*Thiết bị*) → **Grant a USB device…** (*Cấp quyền thiết bị USB…*) → pick the printer in Chrome's chooser. 2. **Printers** → edit `printer-k80` → **Device** (*Thiết bị*) → choose it from **Pick a granted device…** (*Chọn thiết bị đã cấp quyền…*) → **Save** (*Lưu*). 3. In **Document mapping** map `RECEIPT` → `printer-k80`. 4. Restart Chrome and reopen **Devices** and **Printers** | The device is listed with `vendorId:productId` (and serial number if the device has one). **Status** shows **Ready** (*Sẵn sàng*). After restart the device is still listed and the profile is still **Ready** |
| EP-02 | EP-01, K80 | **Test print** → `printer-k80` → **Test receipt K80/K58 (ESC/POS)** (*In thử hoá đơn K80/K58 (ESC/POS)*). Then send Appendix C.1 as `RECEIPT` | Receipt prints at full width, separator lines are 48 characters and not wrapped, no truncated lines. Job ends `SUBMITTED`, outcome `BYTES_WRITTEN_TO_DEVICE`. With `ascii` the test receipt's title line shows `?` in place of `·` (known, see EP-05) |
| EP-03 | EP-01 for K58 (`printer-k58`, mapping `RECEIPT_K58`) | Same as EP-02 on `printer-k58` | Separator lines are 32 characters and fit 58 mm, no wrapping artefacts |
| EP-04 | EP-02 | 1. With **Auto cut** (*Tự cắt giấy*) on, run **Test receipt** and send Appendix C.1. 2. Turn **Auto cut** off, save, repeat both. 3. With **Auto cut** on, send Appendix C.1 with `cut: true` (payload already ends with a cut) | 1. Paper is cut after each receipt: the extension appends feed + cut (`ESC d 3`, `GS V 65 3`) to ESC/POS jobs when Auto cut is on, the built-in test receipt included. 2. No cut. 3. Exactly one cut (no extra cut is appended when the payload already ends with `GS V`) |
| EP-05 | EP-02 | Send Appendix C.2 (text `Phở bò, Nguyễn Thị Hương, Đà Nẵng` as an ESC/POS text payload) three times, switching the profile's **Text encoding** to `ascii`, `utf-8`, `latin1` | `ascii`: text prints without diacritics: `Pho bo, Nguyen Thi Huong, Da Nang`. `utf-8`: depends on firmware; record exactly what prints (photo). `latin1`: most Vietnamese letters become `?`; record. The built-in test receipt's line `Tieng Viet: Đơn thuốc - Hóa đơn` follows the same rule. **Known gap:** there is no Vietnamese code-page option (only `utf-8`, `ascii`, `latin1`); correct diacritics on printers without UTF-8 support need new work |
| EP-06 | EP-02 | Barcode: the built-in **Test receipt** prints a CODE128 barcode. QR: optional, Appendix C.3 | Barcode scans as `XDEV-TEST-001`. QR: the extension has no QR builder; Appendix C.3 sends raw Epson-style `GS ( k` bytes that the tester supplies. Record PASS/FAIL per printer, or `N/A` if not run |

## 4. WebUSB ZPL/TSPL (device: label printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| LB-01 | Label printer granted and set on `printer-label` (same steps as EP-01), 50×30 mm labels loaded, `SPECIMEN_LABEL` mapped | **Test print** → `printer-label` → **Test label (ZPL)** (*In thử tem (ZPL)*) or **Test label (TSPL)** (*In thử tem (TSPL)*) per model. Then send Appendix D.1 (ZPL) or D.2 (TSPL) | Label is aligned, nothing clipped, one label per job. Job ends `SUBMITTED` |
| LB-02 | LB-01 | Scan the barcode of each printed label with a handheld scanner | Test label returns `XDEV-TEST-001`; Appendix D label returns `SPEC0001` |
| LB-03 | LB-01 | Send Appendix D.1 or D.2 with `copies: 5` | Exactly 5 labels (the payload is repeated 5 times) |
| LB-04 | LB-01 | Send Appendix D.3 (Vietnamese text) with **Text encoding** `utf-8`, then `ascii` | `ascii`: unaccented text. `utf-8`: record what prints (ZPL sample uses `^CI28`; the TSPL sample sets no code page). Diacritics correct, or the limitation is recorded |

## 5. Web Serial (device: serial or USB-serial printer)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| WS-01 | Printer on a COM/serial port | 1. **Devices** → **Grant a serial port…** (*Cấp quyền cổng Serial…*) → pick the port. 2. **Printers** → edit `printer-serial` (connection **Web Serial (RAW commands)**) → **Device** → pick the port → set **Baud rate** to the printer's value (9600–115200; data bits 8, stop bits 1, no parity, no flow control are fixed) → **Save**. 3. Map `SERIAL_TEST` → `printer-serial`. 4. Restart Chrome | Port is listed (`Serial vvvv:pppp`, or `Serial port #n` without USB ids) and still listed after restart; profile **Ready** |
| WS-02 | WS-01, receipt printer | Repeat EP-02, EP-04, EP-05 with `documentType: 'SERIAL_TEST'` | Same results as the WebUSB cases; job outcome `BYTES_WRITTEN_TO_PORT` |
| WS-03 | WS-01, label printer | Repeat LB-01, LB-02 with `documentType: 'SERIAL_TEST'` | Same results as the WebUSB cases |
| WS-04 | WS-01 | Set a wrong **Baud rate**, print | Record what prints and the job state. Web Serial cannot detect a baud mismatch, so the job is expected to end `SUBMITTED` with garbage or no output |

## 6. Device errors

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| ER-01 | EP-02 | Send Appendix C.4 (long receipt, more than 16 KB) and unplug the USB cable while it prints | No hang; job ends within about 1 minute. If some bytes were written: `FAILED`, outcome `PARTIAL_TRANSFER`, `errorCode` `TRANSFER_FAILED`, not retried (to avoid duplicate output). If the failure happened before any byte was written: `TRANSFER_FAILED` / `DEVICE_DISCONNECTED` are retryable, so the job is retried up to 3 attempts (**Outcome** shows `RETRY_AFTER_…` meanwhile) and then ends `FAILED`, usually `DEVICE_NOT_FOUND`. If the printer had already buffered everything, the job may end `SUBMITTED` while paper stops. Record which happened; **Print history** shows the error |
| ER-02 | ER-01 | Plug back in, print again | Works; record whether the device had to be granted again on **Devices** |
| ER-03 | Printer cover open or no paper | Print | Record what the printer does and the job state/outcome |
| ER-04 | Windows, default `usbprint.sys` driver owns the printer (no WinUSB) | Print to `printer-k80` | `FAILED`, `errorCode` `DEVICE_BUSY` after 3 attempts, message `Cannot claim USB interface (…). The OS printer driver may own it.` or `Cannot open USB device (…). Another driver or tab may hold it.` **Expected FAIL until T9:** the message and admin UI do not yet point to the fix guide |
| ER-05 | EP-01 | (a) Revoke the device on **Devices** → **Revoke** (*Thu hồi quyền*), or unplug it, then print to its mapping. (b) Edit a WebUSB profile and clear **Device** (choose **Pick a granted device…**), print | (a) `FAILED`, `DEVICE_NOT_FOUND` (`USB printer not connected or permission not granted`) after 3 attempts (retryable; `RETRY_AFTER_DEVICE_NOT_FOUND` visible in between). (b) `FAILED`, `DEVICE_NOT_FOUND` (`Profile has no USB device`) at once, not retried |

## 7. Real permissions (no printer needed)

| ID | Preconditions | Steps | Expected |
|---|---|---|---|
| PM-01 | A real https site, extension installed, site not yet allowed | (a) Admin: **Websites** → enter the origin → **Allow website**. (b) Repeat on another origin from the toolbar popup on that site's tab: **Allow this website** (*Cho phép website này*). Accept Chrome's prompt each time | Chrome's prompt names the right origin. After accepting, the origin is listed in **Websites** (and the popup shows **Allowed to print** (*Đã được phép in*)); `xp('ping')` answers on that site without reloading the tab |
| PM-02 | Site not yet allowed | (a) **Allow website**, then deny Chrome's prompt. (b) Before allowing, run `await xp('ping', {}, 2000)` on the site (or SDK `connect()`) | (a) Error notice `Chrome permission was not granted`; the origin is not listed; `chrome://extensions` → site access shows no access for it. (b) No approval window; the helper rejects with `TIMEOUT` (SDK: `connect()` throws `NotInstalledError`, code `NOT_INSTALLED`), because the bridge is only injected into allowed sites |
| PM-03 | PM-01, approval window flow | 1. In **Websites** untick **Print** for the site (only **Read configuration** left). 2. On the site run `await xp('connect', { scopes: ['read','print'], sdkVersion: 'manual' })`. 3. The extension window "A website wants to use your printers" (*Website yêu cầu kết nối máy in*) opens with the site origin and **Print** ticked: (a) click **Allow** (*Cho phép*); repeat steps 1–2 and (b) click **Deny** (*Từ chối*) | (a) `connect` returns scopes `["read","print"]`; `xprint` works. (b) `connect` still succeeds with scopes `["read"]` (no error, the site already has a grant); `xprint` fails with `PERMISSION_DENIED` (`Missing "print" permission`) |
| PM-04 | PM-03 | (a) Repeat PM-03 steps 1–2 and leave the approval window open for 2 minutes. (b) In **Websites** tick **Ask before every print** (*Hỏi xác nhận mỗi lần in*), send any job, approve it within 2 minutes. (c) Send another job and leave the "Confirm print job" (*Xác nhận lệnh in*) window for 2 minutes | (a) The window closes by itself after 2 minutes, handled as a deny: `connect` returns the existing scopes only. (b) Job leaves `WAITING_PERMISSION` and prints. (c) The window closes after 2 minutes; job ends `CANCELLED`, outcome `USER_DENIED`, `errorCode` `PERMISSION_DENIED` (SDK `print()` rejects with `PrintJobError`, code `PERMISSION_DENIED`) |
| PM-05 | PM-01 | **Websites** → **Revoke** (*Thu hồi*) the site. Then, in a tab of that site opened before the revoke and not reloaded, run `xp('getStatus')` and `xp('connect', …)`; then reload the tab and run `xp('ping')` | Site is removed from the list and from `chrome://extensions` site access. Old tab: `getStatus` fails with `ORIGIN_NOT_ALLOWED`; record whether `connect` opens an approval window (code reading says it does, and **Allow** then fails with `PERMISSION_DENIED`, **Deny** with `PAIRING_REJECTED`). After reload: no bridge (`ping` times out) |

## Record template

Copy one per device and OS.

```
Date:
Tester:
OS + version:
Chrome version:
Extension version / commit:
Printer model:
Connection (USB / serial / network):
Firmware / driver (and WinUSB/udev used):

Case results (PASS / FAIL / N/A, with notes and bug task ID):
PD-01 .. PD-05:
KP-01 .. KP-03:
EP-01 .. EP-06:
LB-01 .. LB-04:
WS-01 .. WS-04:
ER-01 .. ER-05:
PM-01 .. PM-05:

Photos (printouts, with filename):
Verdict (promote to Verified on Physical Printer? yes/no):
```

## Appendix A — console helper

The SDK is not published yet, so the cases talk to the extension with the page protocol (`docs/API.md`, "Protocol"). Paste into the DevTools console of a page on the allowed site. If your site bundles `@tdduydev/browser-print`, the SDK equivalent is shown in comments.

```js
// Logs job/status events once.
if (!window.__xpEvents) {
  window.__xpEvents = true;
  addEventListener('message', (e) => {
    const d = e.data;
    if (e.source === window && d?.channel === 'xdev-browser-print' && d.dir === 'from-ext' && d.kind === 'event') console.log('[event]', d.payload);
  });
}
const hex = () => crypto.randomUUID().replace(/-/g, '');
// One request; resolves with result, rejects with { code, message, details }.
window.xp = (method, params = {}, timeoutMs = 130000) =>
  new Promise((resolve, reject) => {
    const requestId = 'req_' + hex();
    const on = (e) => {
      const d = e.data;
      if (e.source !== window || d?.channel !== 'xdev-browser-print' || d.dir !== 'from-ext' || d.kind !== 'response') return;
      if (d.payload.requestId !== requestId) return;
      clearTimeout(timer);
      removeEventListener('message', on);
      d.payload.ok ? resolve(d.payload.result) : reject(d.payload.error);
    };
    const timer = setTimeout(() => { removeEventListener('message', on); reject({ code: 'TIMEOUT', message: method }); }, timeoutMs);
    addEventListener('message', on);
    postMessage({ channel: 'xdev-browser-print', dir: 'to-ext', kind: 'request', payload: { requestId, sentAt: Date.now(), method, params } }, location.origin);
  });
// Bytes -> base64 (chunked for large files).
window.b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
// Submits a job and polls until a final state. SDK: await printer.print({ documentType, format, data, copies })
window.xprint = async (params) => {
  const accepted = await xp('print', { idempotencyKey: 'idem_' + hex(), ...params });
  console.log('accepted', accepted);
  for (;;) {
    const s = await xp('getJobStatus', { jobId: accepted.jobId }, 10000);
    if (['SUBMITTED', 'UNKNOWN', 'FAILED', 'CANCELLED'].includes(s.state)) return s;
    await new Promise((r) => setTimeout(r, 1000));
  }
};
await xp('connect', { scopes: ['read', 'print'], sdkVersion: 'manual' }); // SDK: await printer.connect()
```

`format` must be one of `PDF`, `HTML`, `ESCPOS`, `ZPL`, `TSPL`, `RAW`. `dataEncoding` is `'text'` for a string or `'base64'` for bytes (`PDF` and `RAW` must be base64). Text payloads of raw formats are encoded with the profile's **Text encoding**; base64 payloads are sent byte-for-byte.

## Appendix B — print dialog samples

B.1 A5 HTML prescription (PD-01, KP-01):

```js
await xprint({ documentType: 'PRESCRIPTION', format: 'HTML', dataEncoding: 'text', data: `<!doctype html><html><head><style>
body{font-family:Arial,sans-serif;font-size:12pt} h1{font-size:16pt;text-align:center;margin:0 0 4mm}
table{width:100%;border-collapse:collapse} td,th{border:1px solid #000;padding:1.5mm;text-align:left}
</style></head><body>
<h1>ĐƠN THUỐC</h1>
<p>Họ tên: Nguyễn Thị Hương &nbsp; Tuổi: 45 &nbsp; Giới: Nữ</p>
<p>Địa chỉ: 12 Lê Lợi, Hải Châu, Đà Nẵng</p>
<p>Chẩn đoán: Viêm họng cấp</p>
<table><tr><th>#</th><th>Thuốc</th><th>SL</th><th>Cách dùng</th></tr>
<tr><td>1</td><td>Amoxicillin 500mg</td><td>14</td><td>Uống 2 viên/ngày, sáng – tối</td></tr>
<tr><td>2</td><td>Paracetamol 500mg</td><td>10</td><td>Uống khi sốt trên 38,5°C</td></tr></table>
<p style="margin-top:8mm;text-align:right">Ngày 08 tháng 10 năm 2026<br>Bác sĩ khám bệnh</p>
</body></html>` });
```

B.2 A4 PDF invoice from a local file (PD-02). Run, then click the file input that appears at the top-left of the page:

```js
const input = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'file', accept: 'application/pdf' }));
input.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:#fff';
const file = await new Promise((r) => (input.onchange = () => r(input.files[0])));
input.remove();
await xprint({ documentType: 'INVOICE', format: 'PDF', dataEncoding: 'base64', data: b64(new Uint8Array(await file.arrayBuffer())) });
// SDK: await printer.printPdf('INVOICE', file)
```

B.3 Sanitizer check (PD-05). Replace the image URL with any public https image:

```js
await xprint({ documentType: 'PRESCRIPTION', format: 'HTML', dataEncoding: 'text', data: `<html><body>
<h1 id="t">Sanitizer test</h1>
<script>alert('script ran'); document.getElementById('t').textContent = 'SCRIPT RAN';</script>
<p onclick="alert('handler ran')">Paragraph with an inline handler</p>
<img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" width="200" alt="remote image">
</body></html>` });
```

## Appendix C — ESC/POS samples

C.1 Receipt (EP-02, EP-03, EP-04, WS-02). Text payload with ESC/POS commands; `cut: true` appends `GS V 65 3`. Use `RECEIPT_K58` for K58 and `SERIAL_TEST` for serial:

```js
const receipt = ({ width = 48, cut = false } = {}) => {
  const sep = '-'.repeat(width);
  return '\x1b@' + '\x1ba\x01' + '\x1bE\x01' + 'PHONG KHAM XDEV\n' + '\x1bE\x00' + 'Hoa don ban le\n' + '\x1ba\x00' + sep + '\n' +
    'Kham tong quat'.padEnd(width - 10) + '150,000'.padStart(10) + '\n' +
    'Xet nghiem mau'.padEnd(width - 10) + '220,000'.padStart(10) + '\n' + sep + '\n' +
    'TONG'.padEnd(width - 10) + '370,000'.padStart(10) + '\n' + '\x1bd\x03' + (cut ? '\x1dVA\x03' : '');
};
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'text', data: receipt() });
// K58: receipt({ width: 32 }) with documentType 'RECEIPT_K58'.  EP-04 step 3: receipt({ cut: true })
```

C.2 Vietnamese text (EP-05):

```js
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'text', data: '\x1b@Phở bò, Nguyễn Thị Hương, Đà Nẵng\n\x1bd\x03' });
```

C.3 QR code, optional (EP-06). Not generated by the extension; these are raw Epson-style `GS ( k` model 2 commands supplied by the tester, not verified by this repo. Sent as base64 so no text encoding is applied:

```js
const qr = (text) => {
  const d = [...new TextEncoder().encode(text)], n = d.length + 3;
  return new Uint8Array([0x1b, 0x40, 0x1b, 0x61, 1,
    0x1d, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0,          // model 2
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6,                // module size 6
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x31,             // error correction M
    0x1d, 0x28, 0x6b, n & 255, n >> 8, 0x31, 0x50, 0x30, ...d, // store data
    0x1d, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30,             // print
    0x0a, 0x1b, 0x64, 3]);
};
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'base64', data: b64(qr('XDEV-QR-0001')) });
```

C.4 Long receipt for the unplug test (ER-01), about 40 KB:

```js
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'text', data: '\x1b@' + Array.from({ length: 1200 }, (_, i) => `Line ${String(i + 1).padStart(4, '0')} xDev unplug test ......\n`).join('') + '\x1bd\x03' });
```

## Appendix D — label samples (50×30 mm)

D.1 ZPL at 8 dots/mm (203 dpi). For 12 dots/mm use `^PW600` and `^LL360`:

```js
const zpl = ['^XA', '^CI28', '^PW400', '^LL240',
  '^FO20,20^A0N,28,28^FDBN: Nguyen Van A^FS',
  '^FO20,60^A0N,24,24^FDXN-2026-0001^FS',
  '^FO20,100^BY2^BCN,60,Y,N,N^FDSPEC0001^FS', '^XZ'].join('\n');
await xprint({ documentType: 'SPECIMEN_LABEL', format: 'ZPL', dataEncoding: 'text', data: zpl });
// LB-03: add copies: 5
```

D.2 TSPL:

```js
const tspl = ['SIZE 50 mm, 30 mm', 'GAP 2 mm, 0 mm', 'DIRECTION 1', 'CLS',
  'TEXT 20,20,"3",0,1,1,"BN: Nguyen Van A"',
  'BARCODE 20,80,"128",60,1,0,2,2,"SPEC0001"', 'PRINT 1,1', ''].join('\r\n');
await xprint({ documentType: 'SPECIMEN_LABEL', format: 'TSPL', dataEncoding: 'text', data: tspl });
```

D.3 Vietnamese label text (LB-04): in D.1 replace the first field with `^FDBệnh nhân: Nguyễn Văn Ấn^FS`, or in D.2 the first `TEXT` value with `"Bệnh nhân: Nguyễn Văn Ấn"`.
