# Nộp Chrome Web Store — xDev Browser Print

Bản tiếng Anh: [../CHROME_WEB_STORE.md](../CHROME_WEB_STORE.md)

Nội dung để dán vào Chrome Web Store Developer Dashboard, và danh sách việc cho lần nộp đầu tiên (Phase 2, task T11).

Mọi nhận định về hành vi của tiện ích dưới đây đã được đối chiếu với mã nguồn; tên file ghi ngay bên cạnh. Nhận định về Chrome Web Store hoặc Google Cloud mà repo này không chứng minh được thì ghi **[Chưa xác minh]**. Hãy kiểm tra lại trong Dashboard trước khi dựa vào.

Các đoạn văn để dán vào tab Privacy (mục 2–4) giữ bằng tiếng Anh, vì người duyệt của Google đọc tiếng Anh. Phần giải thích bằng tiếng Việt.

## 1. Thông tin cửa hàng

### 1.1 Trường cố định

| Trường | Giá trị | Nguồn |
|---|---|---|
| Tên | `xDev Browser Print` | `apps/extension/manifest.config.ts` (`name`) |
| Tóm tắt (Summary) | Lấy từ `description` trong manifest (`__MSG_extDescription__`), mỗi ngôn ngữ một bản. Nội dung ở dưới. | `apps/extension/public/_locales/*/messages.json` |
| Ngôn ngữ mặc định | Tiếng Việt (`vi`) | `manifest.config.ts` (`default_locale: 'vi'`) |
| Ngôn ngữ khác | Tiếng Anh (`en`) | `public/_locales/en` |
| Danh mục (đề xuất) | Productivity → Tools **[Chưa xác minh: kiểm tra tên danh mục Dashboard đang hiển thị]** | — |
| Biểu tượng | `apps/extension/public/icons/icon-128.png` (128×128) | — |
| Ảnh chụp màn hình | Mục 7 | `docs/images/cws/` |
| URL chính sách quyền riêng tư | `https://github.com/tdduydev/xdev-browser-print/blob/main/docs/PRIVACY.md` | [PRIVACY.md](PRIVACY.md) |
| Trang chủ / hỗ trợ | `https://github.com/tdduydev/xdev-browser-print` | — |

### 1.2 Tóm tắt (tối đa 132 ký tự)

Dashboard lấy tóm tắt từ manifest, nên muốn đổi thì phải sửa `messages.json` và phát hành phiên bản mới.

| Ngôn ngữ | Nội dung | Số ký tự |
|---|---|---|
| `en` | Print prescriptions, invoices and labels from web apps. Map document types to printers; print via Chrome, WebUSB or Web Serial. | 127 |
| `vi` | In đơn thuốc, hoá đơn, tem nhãn từ ứng dụng web: cấu hình máy in theo loại chứng từ, in qua hộp thoại Chrome hoặc WebUSB/Web Serial. | 132 |

Bản tiếng Việt đúng bằng giới hạn. Mọi chỉnh sửa phải giữ ở mức 132 ký tự trở xuống.

### 1.3 Mô tả chi tiết — tiếng Anh

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

### 1.4 Mô tả chi tiết — tiếng Việt

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

## 2. Mục đích duy nhất (Single purpose)

Dán vào Privacy → Single purpose description:

```text
Print documents from web applications the user has explicitly allowed (prescriptions, invoices, receipts, labels) on the printer the user configured for each document type, through Chrome's print dialog or, for raw-command receipt/label printers, through WebUSB or Web Serial.
```

## 3. Giải trình quyền

Mỗi đoạn dán vào một ô trong Privacy → Permission justification. Manifest được tạo bởi `apps/extension/manifest.config.ts`.

### `storage`

```text
Saves the extension's configuration on this computer with chrome.storage.local: printer profiles, the mapping from document type to printer, settings, and the list of websites the user allowed with their scopes. chrome.storage.session briefly remembers a site the user is adding while Chrome shows the host permission prompt, because the popup can close during the prompt. Nothing is stored with chrome.storage.sync and nothing leaves the computer.
```

Đã đối chiếu: `storage/config-store.ts` (khoá `config`, `sites`; "never sync"), `background/sites.ts` (khoá session `pendingSite`, hết hạn sau 5 phút), `ui/i18n.ts` (đọc `config` để lấy ngôn ngữ).

### `scripting`

```text
Registers the extension's small message-relay content script only on the websites the user allowed, at the moment the user allows them, and removes it when the user revokes the site. The manifest declares no content scripts, so no page gets the relay by default. The relay only passes print requests between the allowed page and the extension; it does not read or change the page.
```

Đã đối chiếu: `background/sites.ts` (`registerContentScripts`, `unregisterContentScripts`, `executeScript` vào các tab đang mở của host được cho phép), `content/index.ts` (chỉ chuyển tiếp), manifest không có `content_scripts`.

### `activeTab`

```text
When the user opens the toolbar popup, the extension reads the address of the current tab to show whether that site is allowed to print and to offer an "Allow this website" button. The address is not stored unless the user then allows the site.
```

Đã đối chiếu: `popup/main.tsx` (`chrome.tabs.query({ active: true, currentWindow: true })`, chỉ giữ `URL.origin` trong state của component).

### Quyền host (`optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*`)

```text
The extension requests no host access at install time. Host access is optional and is requested from Chrome for one exact website at a time, only when the user clicks "Allow website" in the options page or the popup; Chrome shows its own prompt for that single site. The pattern https://*/* is listed only so the user can choose which business web application to allow; wildcards are rejected and access is never requested for all sites. http://localhost and http://127.0.0.1 are listed for developers integrating the SDK. Access is used only to inject the relay content script into the allowed site. Revoking the site in the extension or in chrome://extensions removes the access and the relay.
```

Đã đối chiếu: `manifest.config.ts` (bản phát hành không có `host_permissions`), `lib/site-permission.ts` (`chrome.permissions.request` cho đúng một mẫu origin), `packages/core/src/origin.ts` (chỉ origin `https` chính xác; localhost chỉ khi bật cài đặt `allowLocalhost`), `background/sites.ts` (`remove`, `reconcile`, `onPermissionsRemoved`). `scripts/package-extension.mjs` từ chối đóng gói manifest có `host_permissions`.

### WebUSB

WebUSB không phải quyền khai báo trong manifest, nên Dashboard không có ô cho nó **[Suy luận: dựa trên cấu trúc manifest; Dashboard chỉ liệt kê quyền trong manifest]**. Dán đoạn này vào phần ghi chú thêm cho người duyệt nếu Dashboard có; nếu không, mô tả chi tiết đã nêu.

```text
WebUSB (navigator.usb) is used only for receipt and label printers that accept raw commands (ESC/POS, ZPL, TSPL). The user grants each USB device explicitly through Chrome's device chooser on the extension's Devices screen and can forget it there. The extension writes print data only to granted devices that the user assigned to a printer profile. It does not enumerate or access any other USB device.
```

Đã đối chiếu: `lib/devices.ts` (`requestDevice`, `getDevices`, `forget`, gọi từ `options/screens/Devices.tsx`), `background/index.ts` và `adapters/webusb-adapter.ts` (ghi từ service worker bằng `getDevices()`), `print/main.ts` (dự phòng trong cửa sổ phụ).

### Web Serial

Giống WebUSB: không phải quyền trong manifest **[Suy luận]**.

```text
Web Serial (navigator.serial) is used only for receipt and label printers connected through a serial or USB-serial port. The user grants each port explicitly through Chrome's port chooser on the extension's Devices screen and can forget it there. Print data is written only to a granted port assigned to a printer profile, from a small extension window, because Web Serial is not available in the service worker.
```

Đã đối chiếu: `lib/devices.ts` (`requestPort`, `getPorts`, `forget`), `print/main.ts` và `adapters/webserial-adapter.ts`, `background/runner.ts` (mở `print.html` làm cửa sổ phụ).

## 4. Mã từ xa (Remote code)

Trả lời: **No, I am not using remote code.**

Nội dung giải trình nếu được hỏi:

```text
All JavaScript is bundled into the extension package at build time. The extension pages run under the CSP "script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'". The code does not use eval, new Function or remotely hosted scripts, and makes no network requests of its own.
```

Đã đối chiếu:

- CSP: `manifest.config.ts` (`content_security_policy.extension_pages`).
- Đóng gói: `apps/extension/vite.config.ts` (mọi entry được Vite build vào `dist/`), `vite.content.config.ts`.
- `eslint.config.js` bắt buộc `no-eval`, `no-implied-eval`, `no-new-func`.
- `grep` trong `apps/extension/src`, `packages/core/src`, `packages/shared-types/src` không thấy `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `eval(` hay `new Function`. Bản build `apps/extension/dist/` không có `eval(`/`new Function(`, không có `fetch`/`XMLHttpRequest`/`WebSocket`; các chuỗi `http(s)://` duy nhất là namespace XML, URL trang lỗi của React trong thông báo lỗi, mẫu match của manifest và origin ví dụ trong giao diện.
- HTML do trang gửi được DOMPurify làm sạch (không còn `script`) và hiển thị trong iframe không có `allow-scripts`: `print/render.ts`. Đây là dữ liệu để in, không phải mã tiện ích chạy.

## 5. Sử dụng dữ liệu

### 5.1 Mã nguồn làm gì với dữ liệu

| Dữ liệu | Lưu ở đâu | Bao lâu | Có rời khỏi máy không? |
|---|---|---|---|
| Cấu hình: cấu hình máy in (tên, khổ giấy, lề, kiểu kết nối, với USB/serial là vendor id, product id và số serial USB của thiết bị đã cấp quyền, thông số cổng serial), gán chứng từ, cài đặt | `chrome.storage.local` khoá `config` | Đến khi sửa hoặc gỡ tiện ích | Không |
| Website được cho phép: origin, quyền, thời điểm cấp, nhãn (tuỳ chọn), "hỏi mỗi lần in" | `chrome.storage.local` khoá `sites` | Đến khi thu hồi | Không |
| Trang đang được thêm trong lúc Chrome hiện hộp thoại cấp quyền | `chrome.storage.session` khoá `pendingSite` | Xoá khi hoàn tất, bỏ qua sau 5 phút, mất khi đóng trình duyệt | Không |
| Chứng từ cần in (PDF, HTML hoặc lệnh máy in RAW) do trang được cho phép gửi | IndexedDB `xdev-browser-print`, store `payloads`, và bộ nhớ của service worker / cửa sổ in | Từ lúc kiểm tra đến khi lệnh in ở trạng thái cuối (`SUBMITTED`, `FAILED`, `CANCELLED`, `UNKNOWN`), sau đó bị xoá | Chỉ tới máy in của người dùng: hộp thoại in của Chrome, hoặc thiết bị USB/serial đã cấp quyền |
| Lịch sử in: mã lệnh, idempotency key, origin của trang, loại chứng từ, định dạng, kích thước (byte), số bản, cấu hình máy in, trạng thái, kết quả, mã/thông báo lỗi, số lần thử, thời điểm | IndexedDB `xdev-browser-print`, store `jobs` | Mặc định 500 lệnh mới nhất (cài đặt `historyLimit`, 10–5000); "Xoá lịch sử" xoá các lệnh đã kết thúc | Không |
| Địa chỉ tab hiện tại khi mở popup | Chỉ trong bộ nhớ popup | Khi popup đang mở | Không |

Nguồn: `storage/config-store.ts`, `background/sites.ts`, `storage/job-store.ts`, `printing/job-manager.ts` (`putPayload`, `deletePayload` ở mọi trạng thái cuối, `prune(historyLimit)`), `packages/shared-types/src/jobs.ts` ("Metadata only. Document content is never stored in history."), `packages/core/src/config.ts` (`historyLimit: 500`), `background/index.ts` (`sanitizeSettings` giới hạn 10–5000), `popup/main.tsx`.

Không có trong mã nguồn: phân tích sử dụng, telemetry, báo lỗi tự động, ghi log từ xa, tài khoản, cookie, quảng cáo. Mã tiện ích không có lệnh `console.*` nào, nên cũng không ghi log cục bộ.

Một tác động mạng cần biết: chứng từ HTML được in đúng như trang viết. Nếu HTML đó tham chiếu ảnh hoặc stylesheet qua URL, Chrome tải chúng từ URL đó khi dựng bản xem trước (`img-src` không bị giới hạn). Tiện ích không thêm gì vào các yêu cầu này và URL do chính trang cung cấp. Xem `docs/vi/SECURITY.md`, rủi ro còn lại.

### 5.2 Các ô cần tick trong Dashboard

Tiện ích xử lý nội dung chứng từ mà website được cho phép gửi để in. Chứng từ có thể chứa thông tin cá nhân, sức khoẻ và tài chính (đơn thuốc, hoá đơn). Tất cả được xử lý trên máy người dùng và chỉ đi tới máy in của người dùng.

Chính sách của Google về dữ liệu chỉ xử lý trên thiết bị là điều repo này không xác minh được **[Chưa xác minh]**. Lựa chọn thận trọng, được đề xuất ở đây, là khai báo các loại dữ liệu mà chứng từ có thể chứa:

| Loại | Tick? | Lý do |
|---|---|---|
| Personally identifiable information | Có (thận trọng) | Chứng từ in có thể chứa họ tên, địa chỉ, số giấy tờ. Chỉ xử lý cục bộ. |
| Health information | Có (thận trọng) | Đơn thuốc và giấy tờ phòng khám. Chỉ xử lý cục bộ. |
| Financial and payment information | Có (thận trọng) | Hoá đơn, phiếu thu. Chỉ xử lý cục bộ. Tiện ích không yêu cầu số thẻ. |
| Authentication information | Không | Không xử lý mật khẩu, thông tin đăng nhập hay token. |
| Personal communications | Không | Không đọc email, chat hay tin nhắn. |
| Location | Không | Không dùng API vị trí. |
| Web history | Không | Không đọc lịch sử duyệt web. Chỉ lưu origin của các trang được cho phép và lịch sử lệnh in. |
| User activity | Không | Không theo dõi click, phím bấm hay di chuột. |
| Website content | Có | Chứng từ do trang được cho phép gửi để in là nội dung website. |

Chủ sở hữu quyết định có giữ các ô "thận trọng" hay không. Chỉ nên bỏ tick khi hướng dẫn hiện hành của Google nói rằng dữ liệu không rời thiết bị thì không tính là thu thập.

### 5.3 Ba cam kết

Tick cả ba. Cả ba đều đúng vì không có dữ liệu nào được gửi đi đâu ngoài máy in của người dùng:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## 6. Chế độ hiển thị và lần nộp đầu tiên

### 6.1 Chế độ hiển thị

Đề xuất cho v0.2.0: **Unlisted**. Chỉ người có link mới tìm thấy và cài được, phù hợp với việc phân phối cho khách hàng đã biết. Có thể chuyển sang Public sau.

### 6.2 Danh sách việc cho quản trị viên

API chỉ cập nhật được item đã tồn tại, nên lần tải lên đầu tiên phải làm tay. Các bước ghi [Chưa xác minh] lấy từ mô tả task hoặc hiểu biết chung về công cụ của Google, không phải từ repo này.

1. **Tài khoản developer.** Đăng ký Chrome Web Store Developer Dashboard bằng tài khoản Google của nhóm; trả phí đăng ký một lần và bật xác minh 2 bước **[Chưa xác minh: mức phí và yêu cầu hiện tại]**.
2. **Publisher ID.** Dashboard → Publisher → Settings. Đây là biến môi trường GitHub `CWS_PUBLISHER_ID` (không phải secret).
3. **Build gói.** Trên bản checkout sạch của tag phát hành: `pnpm install --frozen-lockfile && pnpm release`. Tải lên `release/xdev-browser-print-<version>.zip`. `scripts/package-extension.mjs` từ chối bản build e2e.
4. **Tạo item.** Dashboard → New item → tải ZIP lên (API V2 không tạo được item). Item ID hiện ra sau đó là biến môi trường `CWS_EXTENSION_ID`.
5. **Tab Store listing.** Mục 1: mô tả chi tiết cho `vi` và `en`, danh mục, biểu tượng, ảnh chụp (mục 7), URL trang chủ. Có thể bắt buộc ảnh quảng cáo nhỏ (440×280) **[Chưa xác minh]**; task này không tạo ảnh đó.
6. **Tab Privacy.** Mục đích duy nhất (mục 2), giải trình quyền (mục 3), mã từ xa "No" (mục 4), sử dụng dữ liệu và ba cam kết (mục 5), URL chính sách quyền riêng tư `https://github.com/tdduydev/xdev-browser-print/blob/main/docs/PRIVACY.md`. Điền `<contact email>` và ngày hiệu lực trong `docs/PRIVACY.md` rồi merge vào `main` trước, để URL hiện nội dung cuối cùng.
7. **Tab Distribution.** Visibility Unlisted; khu vực tuỳ nhu cầu.
8. **Submit for review.** T11 xong khi item hiện "Pending review". Duyệt hay không là quyết định của Google.
9. **Đăng nhập cho CI (đã xong).** CI dùng Workload Identity Federation, không dùng OAuth client: project Google Cloud `xdev-browser-print`, service account `cws-publisher@xdev-browser-print.iam.gserviceaccount.com`, WIF provider chỉ nhận environment `chrome-web-store` của repo này. Thêm email service account đó trong Developer Dashboard (cài đặt publisher, service accounts) **[Chưa xác minh: vị trí menu chính xác]** để nó được tải lên và phát hành item.
10. **GitHub environment.** Repo Settings → Environments → `chrome-web-store` (đã bật required reviewers và chỉ cho tag `v*.*.*`). Đã có biến `GCP_WIF_PROVIDER` và `CWS_SERVICE_ACCOUNT`; thêm biến `CWS_PUBLISHER_ID` và `CWS_EXTENSION_ID`. Không cần secret.
11. **Đổi visibility về sau.** Sau khi đổi visibility bằng tay trong Dashboard, phải publish tay một lần thì publish qua API từ CI mới chạy lại được **[Chưa xác minh: theo mô tả task]**.

Không bao giờ đưa các giá trị này vào repo, vào memory của Hive hay vào tài liệu.

## 7. Ảnh chụp màn hình

Tạo bằng `pnpm cws:screenshots` (`scripts/cws-screenshots.mjs`): build tiện ích bản phát hành, nạp một bản sao tạm vào Chromium của Playwright, tạo dữ liệu mẫu (trang `https://clinic.example.com` và `https://pharmacy.example.com`, ba cấu hình máy in, bốn gán chứng từ, sáu bản ghi lịch sử chỉ có thông tin) rồi chụp trang tuỳ chọn. Mọi file là PNG 1280×800; script báo lỗi nếu có file sai kích thước. Không dùng dữ liệu cá nhân thật.

Bản sao tạm được thêm `host_permissions` cho đúng hai trang mẫu, vì Playwright không bấm được hộp thoại cấp quyền của Chrome. Thư mục `dist/` dùng để phát hành không bị sửa.

Cửa hàng nhận tối đa 5 ảnh cho mỗi ngôn ngữ **[Chưa xác minh: giới hạn hiện tại]**. Thứ tự đề xuất: tổng quan, máy in, gán chứng từ, lịch sử in, website.

| Màn hình | Tiếng Việt | Tiếng Anh | Đề xuất |
|---|---|---|---|
| Tổng quan | `docs/images/cws/vi-01-dashboard.png` | `docs/images/cws/en-01-dashboard.png` | Có |
| Cấu hình máy in | `docs/images/cws/vi-02-profiles.png` | `docs/images/cws/en-02-profiles.png` | Có |
| Gán chứng từ | `docs/images/cws/vi-03-mappings.png` | `docs/images/cws/en-03-mappings.png` | Có |
| Thiết bị (WebUSB / Web Serial) | `docs/images/cws/vi-04-devices.png` | `docs/images/cws/en-04-devices.png` | Không: danh sách trống vì không cắm thiết bị thật |
| In thử | `docs/images/cws/vi-05-test.png` | `docs/images/cws/en-05-test.png` | Tuỳ chọn |
| Lịch sử in | `docs/images/cws/vi-06-history.png` | `docs/images/cws/en-06-history.png` | Có |
| Website | `docs/images/cws/vi-07-sites.png` | `docs/images/cws/en-07-sites.png` | Có |
| Cài đặt | `docs/images/cws/vi-08-settings.png` | `docs/images/cws/en-08-settings.png` | Tuỳ chọn |

Không chụp popup. Popup đọc địa chỉ tab đang mở, mà trong trình duyệt tự động thì tab đang mở chính là popup, nên nó chỉ hiện "trang không hỗ trợ".
