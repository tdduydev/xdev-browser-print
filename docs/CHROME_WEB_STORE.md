# Chrome Web Store submission — xDev Browser Print

Vietnamese version: [vi/CHROME_WEB_STORE.md](vi/CHROME_WEB_STORE.md)

Paste-ready text for the Chrome Web Store Developer Dashboard, and the checklist for the first submission (Phase 2, task T11).

Every statement about the extension's behaviour below was checked against the source code; the file is named next to it. Statements about the Chrome Web Store or Google Cloud that this repository cannot prove are marked **[Unverified]**. Check them in the Dashboard before relying on them.

## 1. Store listing

### 1.1 Fixed fields

| Field | Value | Source |
|---|---|---|
| Name | `xDev Browser Print` | `apps/extension/manifest.config.ts` (`name`) |
| Summary | Comes from the manifest `description` (`__MSG_extDescription__`), one per locale. Texts below. | `apps/extension/public/_locales/*/messages.json` |
| Default language | Vietnamese (`vi`) | `manifest.config.ts` (`default_locale: 'vi'`) |
| Other languages | English (`en`) | `public/_locales/en` |
| Category (suggestion) | Productivity → Tools **[Unverified: check the category names the Dashboard shows today]** | — |
| Icon | `apps/extension/public/icons/icon-128.png` (128×128) | — |
| Screenshots | Section 7 | `docs/images/cws/` |
| Privacy policy URL | `https://github.com/tdduydev/xdev-browser-print/blob/main/docs/PRIVACY.md` | [PRIVACY.md](PRIVACY.md) |
| Homepage / support URL | `https://github.com/tdduydev/xdev-browser-print` | — |

### 1.2 Summary (max 132 characters)

The Dashboard takes the summary from the manifest, so changing it means changing `messages.json` and releasing a new version.

| Locale | Text | Characters |
|---|---|---|
| `en` | Print prescriptions, invoices and labels from web apps. Map document types to printers; print via Chrome, WebUSB or Web Serial. | 127 |
| `vi` | In đơn thuốc, hoá đơn, tem nhãn từ ứng dụng web: cấu hình máy in theo loại chứng từ, in qua hộp thoại Chrome hoặc WebUSB/Web Serial. | 132 |

The Vietnamese text is exactly at the limit. Any edit must keep it at 132 characters or fewer.

### 1.3 Detailed description — English

```text
xDev Browser Print lets the web applications your organisation uses (clinic, pharmacy, point-of-sale, warehouse) print prescriptions, invoices, receipts and labels on the right printer, from Chrome.

HOW IT WORKS
• An administrator creates printer profiles (A4, A5, K80, K58 receipt, barcode/label) and maps each document type, for example PRESCRIPTION or RECEIPT, to a profile.
• The administrator allows each web application by its exact address. Chrome asks for access to that one site; the extension has no access to any website at install time.
• The web application calls the xDev Browser Print SDK. The extension sends the document to the mapped printer.

PRINTING METHODS
• PDF and HTML documents open Chrome's print dialog, already set to the right paper size and orientation.
• Receipt and label printers that accept raw commands (ESC/POS, ZPL, TSPL) can print without a dialog over WebUSB or Web Serial, only on devices you granted in the Devices screen.

SECURITY AND PRIVACY
• Exact origins only, no wildcards. Per-site permissions: read configuration, print, change document mapping. Optional "ask before every print".
• Site HTML is sanitised and rendered in a sandboxed frame. Per-site rate limit and size limit.
• Documents are processed on this computer only. The extension makes no network requests of its own, has no analytics and no account. Print history keeps metadata only (time, site, document type, format, size, printer, result), never document content.

LIMITATIONS
• Chrome does not let extensions list or choose operating-system printers. PDF/HTML always go through the print dialog, unless Chrome is started with --kiosk-printing.
• Chrome does not report whether the user printed or cancelled in the dialog.

For integrators: SDK documentation at https://github.com/tdduydev/xdev-browser-print
```

### 1.4 Detailed description — Vietnamese

```text
xDev Browser Print giúp các ứng dụng web mà đơn vị bạn đang dùng (phòng khám, nhà thuốc, bán hàng, kho) in đơn thuốc, hoá đơn, phiếu thu và tem nhãn đúng máy in, ngay trên Chrome.

CÁCH HOẠT ĐỘNG
• Quản trị viên tạo cấu hình máy in (A4, A5, K80, K58, máy in mã vạch/tem) và gán mỗi loại chứng từ, ví dụ PRESCRIPTION hoặc RECEIPT, cho một cấu hình.
• Quản trị viên cho phép từng ứng dụng web theo đúng địa chỉ. Chrome hỏi quyền truy cập riêng trang đó; khi cài đặt, tiện ích không có quyền truy cập trang web nào.
• Ứng dụng web gọi SDK xDev Browser Print. Tiện ích gửi chứng từ tới máy in đã gán.

CÁCH IN
• Chứng từ PDF và HTML mở hộp thoại in của Chrome, đã đặt sẵn khổ giấy và hướng giấy.
• Máy in hoá đơn và máy in tem nhận lệnh RAW (ESC/POS, ZPL, TSPL) có thể in không cần hộp thoại qua WebUSB hoặc Web Serial, chỉ với thiết bị bạn đã cấp quyền ở màn hình Thiết bị.

BẢO MẬT VÀ QUYỀN RIÊNG TƯ
• Chỉ chấp nhận địa chỉ chính xác, không dùng ký tự đại diện. Quyền theo từng trang: đọc cấu hình, in, sửa gán chứng từ. Có tuỳ chọn "hỏi trước mỗi lần in".
• HTML của trang được làm sạch và hiển thị trong khung sandbox. Giới hạn số lệnh in và kích thước theo từng trang.
• Chứng từ chỉ được xử lý trên máy này. Tiện ích không tự gửi yêu cầu mạng nào, không có phân tích sử dụng, không cần tài khoản. Lịch sử in chỉ lưu thông tin (thời gian, trang, loại chứng từ, định dạng, kích thước, máy in, kết quả), không lưu nội dung chứng từ.

GIỚI HẠN
• Chrome không cho tiện ích liệt kê hoặc chọn máy in của hệ điều hành. PDF/HTML luôn đi qua hộp thoại in, trừ khi Chrome được khởi động với cờ --kiosk-printing.
• Chrome không báo người dùng đã in hay đã huỷ trong hộp thoại.

Cho đơn vị tích hợp: tài liệu SDK tại https://github.com/tdduydev/xdev-browser-print
```

## 2. Single purpose

Paste into Privacy → Single purpose description:

```text
Print documents from web applications the user has explicitly allowed (prescriptions, invoices, receipts, labels) on the printer the user configured for each document type, through Chrome's print dialog or, for raw-command receipt/label printers, through WebUSB or Web Serial.
```

## 3. Permission justifications

One paragraph per field in Privacy → Permission justification. The manifest is built by `apps/extension/manifest.config.ts`.

### `storage`

```text
Saves the extension's configuration on this computer with chrome.storage.local: printer profiles, the mapping from document type to printer, settings, and the list of websites the user allowed with their scopes. chrome.storage.session briefly remembers a site the user is adding while Chrome shows the host permission prompt, because the popup can close during the prompt. Nothing is stored with chrome.storage.sync and nothing leaves the computer.
```

Verified: `storage/config-store.ts` (keys `config`, `sites`; "never sync"), `background/sites.ts` (session key `pendingSite`, expires after 5 minutes), `ui/i18n.ts` (reads `config` for the language).

### `scripting`

```text
Registers the extension's small message-relay content script only on the websites the user allowed, at the moment the user allows them, and removes it when the user revokes the site. The manifest declares no content scripts, so no page gets the relay by default. The relay only passes print requests between the allowed page and the extension; it does not read or change the page.
```

Verified: `background/sites.ts` (`registerContentScripts`, `unregisterContentScripts`, `executeScript` into already-open tabs of the allowed host), `content/index.ts` (relay only), manifest has no `content_scripts`.

### `activeTab`

```text
When the user opens the toolbar popup, the extension reads the address of the current tab to show whether that site is allowed to print and to offer an "Allow this website" button. The address is not stored unless the user then allows the site.
```

Verified: `popup/main.tsx` (`chrome.tabs.query({ active: true, currentWindow: true })`, keeps only `URL.origin` in component state).

### Host permissions (`optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`)

```text
The extension requests no host access at install time. Host access is optional and is requested from Chrome for one exact website at a time, only when the user clicks "Allow website" in the options page or the popup; Chrome shows its own prompt for that single site. The pattern https://*/* is listed only so the user can choose which business web application to allow; wildcards are rejected and access is never requested for all sites. http://localhost and http://127.0.0.1 are listed for developers integrating the SDK. Access is used only to inject the relay content script into the allowed site. Revoking the site in the extension or in chrome://extensions removes the access and the relay.
```

Verified: `manifest.config.ts` (no `host_permissions` in the shipped build), `lib/site-permission.ts` (`chrome.permissions.request` for one origin pattern), `packages/core/src/origin.ts` (exact `https` origins; localhost only when the `allowLocalhost` setting is on), `background/sites.ts` (`remove`, `reconcile`, `onPermissionsRemoved`). `scripts/package-extension.mjs` refuses to package a manifest that has `host_permissions`.

### WebUSB

WebUSB is not a manifest permission, so the Dashboard has no field for it **[Inference: based on the manifest schema; the Dashboard only lists manifest permissions]**. Paste this into the "additional information" area for reviewers if the Dashboard offers one, otherwise it is already covered by the detailed description.

```text
WebUSB (navigator.usb) is used only for receipt and label printers that accept raw commands (ESC/POS, ZPL, TSPL). The user grants each USB device explicitly through Chrome's device chooser on the extension's Devices screen and can forget it there. The extension writes print data only to granted devices that the user assigned to a printer profile. It does not enumerate or access any other USB device.
```

Verified: `lib/devices.ts` (`requestDevice`, `getDevices`, `forget`, called from `options/screens/Devices.tsx`), `background/index.ts` and `adapters/webusb-adapter.ts` (writes from the service worker with `getDevices()`), `print/main.ts` (fallback in the helper window).

### Web Serial

Same note as WebUSB: not a manifest permission **[Inference]**.

```text
Web Serial (navigator.serial) is used only for receipt and label printers connected through a serial or USB-serial port. The user grants each port explicitly through Chrome's port chooser on the extension's Devices screen and can forget it there. Print data is written only to a granted port assigned to a printer profile, from a small extension window, because Web Serial is not available in the service worker.
```

Verified: `lib/devices.ts` (`requestPort`, `getPorts`, `forget`), `print/main.ts` and `adapters/webserial-adapter.ts`, `background/runner.ts` (opens `print.html` as the helper window).

## 4. Remote code

Answer: **No, I am not using remote code.**

Justification text if asked:

```text
All JavaScript is bundled into the extension package at build time. The extension pages run under the CSP "script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'". The code does not use eval, new Function or remotely hosted scripts, and makes no network requests of its own.
```

Verified:

- CSP: `manifest.config.ts` (`content_security_policy.extension_pages`).
- Bundling: `apps/extension/vite.config.ts` (all entries built by Vite into `dist/`), `vite.content.config.ts`.
- `eslint.config.js` enforces `no-eval`, `no-implied-eval`, `no-new-func`.
- `grep` of `apps/extension/src`, `packages/core/src`, `packages/shared-types/src` finds no `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `eval(` or `new Function`. The built `apps/extension/dist/` has no `eval(`/`new Function(` and no `fetch`/`XMLHttpRequest`/`WebSocket`; the only `http(s)://` strings are XML namespaces, React's error-page URL inside error messages, the manifest match patterns and example origins in UI text.
- Site-supplied HTML is sanitized with DOMPurify (no `script`) and shown in an iframe without `allow-scripts`: `print/render.ts`. This is data printed, not code executed by the extension.

## 5. Data usage

### 5.1 What the code does with data

| Data | Where it is kept | How long | Leaves the computer? |
|---|---|---|---|
| Configuration: printer profiles (name, paper, margins, adapter, for USB/serial the vendor id, product id and USB serial number of the granted device, serial port settings), document mappings, settings | `chrome.storage.local` keys `config` | Until changed or the extension is removed | No |
| Allowed websites: origin, scopes, time granted, optional label, "ask every time" | `chrome.storage.local` key `sites` | Until revoked | No |
| Site being added during Chrome's permission prompt | `chrome.storage.session` key `pendingSite` | Removed when completed, ignored after 5 minutes, cleared when the browser closes | No |
| Print document (PDF, HTML or raw printer commands) sent by an allowed site | IndexedDB `xdev-browser-print`, store `payloads`, and memory of the service worker / print window | From validation until the job reaches a final state (`SUBMITTED`, `FAILED`, `CANCELLED`, `UNKNOWN`), then deleted | Only to the user's own printer: Chrome's print dialog, or a granted USB/serial device |
| Print history: job id, idempotency key, site origin, document type, format, size in bytes, copies, printer profile, state, outcome, error code/message, attempts, timestamps | IndexedDB `xdev-browser-print`, store `jobs` | Newest 500 jobs by default (setting `historyLimit`, 10–5000); "Clear history" deletes finished jobs | No |
| Address of the current tab when the popup is open | Popup memory only | While the popup is open | No |

Sources: `storage/config-store.ts`, `background/sites.ts`, `storage/job-store.ts`, `printing/job-manager.ts` (`putPayload`, `deletePayload` on every final state, `prune(historyLimit)`), `packages/shared-types/src/jobs.ts` ("Metadata only. Document content is never stored in history."), `packages/core/src/config.ts` (`historyLimit: 500`), `background/index.ts` (`sanitizeSettings` clamps 10–5000), `popup/main.tsx`.

Not found in the code: analytics, telemetry, crash reporting, remote logging, accounts, cookies, ads. The extension source has no `console.*` calls, so it does not even log locally.

One network effect to know about: HTML documents are printed as the site wrote them. If that HTML references images or stylesheets by URL, Chrome loads them from that URL when rendering the print preview (`img-src` is not restricted). The extension adds nothing to those requests and the URLs come from the site itself. See `docs/SECURITY.md`, residual risks.

### 5.2 Dashboard checkboxes

The extension handles the content of documents that allowed websites send for printing. Those documents can contain personal, health and financial information (prescriptions, invoices). All of it is processed on the user's computer and goes only to the user's printer.

Google's policy on data processed only on the device is not something this repository can verify **[Unverified]**. The conservative choice, recommended here, is to declare the categories the documents can contain:

| Category | Tick? | Reason |
|---|---|---|
| Personally identifiable information | Yes (conservative) | Printed documents can contain names, addresses, ID numbers. Processed locally only. |
| Health information | Yes (conservative) | Prescriptions and clinic documents. Processed locally only. |
| Financial and payment information | Yes (conservative) | Invoices and receipts. Processed locally only. No card numbers are requested by the extension. |
| Authentication information | No | No passwords, credentials or tokens are handled. |
| Personal communications | No | No email, chat or messages are read. |
| Location | No | No location API is used. |
| Web history | No | Browsing history is not read. Only the origins of sites the user allowed are stored, and the history of print jobs. |
| User activity | No | No clicks, keystrokes or mouse movement are monitored. |
| Website content | Yes | The document an allowed site sends for printing is website content. |

The owner decides whether to keep the conservative ticks. Unticking them is defensible only if Google's current guidance says data that never leaves the device does not count as collected.

### 5.3 Certifications

Tick all three. Each holds because no data is transmitted anywhere except to the user's own printer:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## 6. Visibility and first submission

### 6.1 Visibility

Recommended for v0.2.0: **Unlisted**. Only people with the link can find and install it, which matches distribution to known customers. Switch to Public later if wanted.

### 6.2 Checklist for the administrator

The API can only update an item that already exists, so the first upload is manual. Steps marked [Unverified] come from the task brief or general knowledge of Google's tools, not from this repository.

1. **Developer account.** Register at the Chrome Web Store Developer Dashboard with the team's Google account; pay the one-time registration fee and enable 2-step verification **[Unverified: current fee and requirements]**.
2. **Publisher ID.** Dashboard → Publisher → Settings. It becomes the GitHub environment variable `CWS_PUBLISHER_ID` (not a secret).
3. **Build the package.** On a clean checkout of the release tag: `pnpm install --frozen-lockfile && pnpm release`. Upload `release/xdev-browser-print-<version>.zip`. `scripts/package-extension.mjs` refuses the e2e build.
4. **Create the item.** Dashboard → New item → upload the ZIP (API V2 cannot create items). The item ID shown afterwards becomes the environment variable `CWS_EXTENSION_ID`.
5. **Store listing tab.** Section 1: detailed description for `vi` and `en`, category, icon, screenshots (section 7), homepage URL. A small promotional tile (440×280) may be required **[Unverified]**; this task does not produce one.
6. **Privacy tab.** Single purpose (section 2), permission justifications (section 3), remote code "No" (section 4), data usage and the three certifications (section 5), privacy policy URL `https://github.com/tdduydev/xdev-browser-print/blob/main/docs/PRIVACY.md`. Fill `<contact email>` and the effective date in `docs/PRIVACY.md` and merge it to `main` first, so the URL shows the final text.
7. **Distribution tab.** Visibility Unlisted; regions as needed.
8. **Submit for review.** T11 is done when the item shows "Pending review". Approval is Google's decision.
9. **CI sign-in (done).** CI uses Workload Identity Federation, not an OAuth client: Google Cloud project `xdev-browser-print`, service account `cws-publisher@xdev-browser-print.iam.gserviceaccount.com`, WIF provider that only accepts this repository's `chrome-web-store` environment. Add that service account email in the Developer Dashboard (publisher settings, service accounts) **[Unverified: exact menu]** so it may upload and publish the item.
10. **GitHub environment.** Repo Settings → Environments → `chrome-web-store` (required reviewers and tag rule `v*.*.*` already set). Variables `GCP_WIF_PROVIDER` and `CWS_SERVICE_ACCOUNT` are set; add the variables `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID`. No secrets are needed.
11. **Visibility changes later.** After changing visibility manually in the Dashboard, publish once manually before API publishes from CI work again **[Unverified: from the task brief]**.

Never put any of these values in the repository, in Hive memory or in documents.

## 7. Screenshots

Generated by `pnpm cws:screenshots` (`scripts/cws-screenshots.mjs`): it builds the production extension, loads a temporary copy in Playwright's Chromium, seeds demo data (sites `https://clinic.example.com` and `https://pharmacy.example.com`, three printer profiles, four mappings, six history records with metadata only) and captures the options page. All files are 1280×800 PNG; the script fails if a file has another size. No real personal data is used.

The temporary copy gets `host_permissions` for the two demo sites only because Playwright cannot click Chrome's permission prompt. The shipped `dist/` is not changed.

The store accepts up to 5 screenshots per locale **[Unverified: current limit]**. Recommended upload order: dashboard, printers, document mapping, history, websites.

| Screen | Vietnamese | English | Recommended |
|---|---|---|---|
| Dashboard | `docs/images/cws/vi-01-dashboard.png` | `docs/images/cws/en-01-dashboard.png` | Yes |
| Printer profiles | `docs/images/cws/vi-02-profiles.png` | `docs/images/cws/en-02-profiles.png` | Yes |
| Document mapping | `docs/images/cws/vi-03-mappings.png` | `docs/images/cws/en-03-mappings.png` | Yes |
| Devices (WebUSB / Web Serial) | `docs/images/cws/vi-04-devices.png` | `docs/images/cws/en-04-devices.png` | No: shows empty lists, since no real device is attached |
| Test print | `docs/images/cws/vi-05-test.png` | `docs/images/cws/en-05-test.png` | Optional |
| Print history | `docs/images/cws/vi-06-history.png` | `docs/images/cws/en-06-history.png` | Yes |
| Websites | `docs/images/cws/vi-07-sites.png` | `docs/images/cws/en-07-sites.png` | Yes |
| Settings | `docs/images/cws/vi-08-settings.png` | `docs/images/cws/en-08-settings.png` | Optional |

The popup is not captured. It reads the active tab's address, and in an automated browser the active tab is the popup itself, so it would only show "unsupported page".
