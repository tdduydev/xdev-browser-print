# Thiết kế tính năng — xDev Browser Print

Phiên bản tài liệu: 0.1.0 · Ngày: 2026-10-08 · Branch: `ai/browser-print-v1`

Tài liệu này mô tả thiết kế của extension, SDK và các quyết định kỹ thuật. Giới hạn của Chrome có nguồn ở mục 2. Kết quả kiểm thử ở `docs/TESTING.md`.

## 1. Mục tiêu và phạm vi

Website ReactJS gửi lệnh in qua SDK. Extension chọn máy in theo loại chứng từ rồi in. Hệ thống không dùng backend, ứng dụng native hay cloud print.

| Thuộc tính | Giá trị |
|---|---|
| Trình duyệt | Google Chrome ≥ 118 trên Windows 10/11, macOS, Linux |
| Manifest | V3 |
| Định dạng | `PDF`, `HTML`, `ESCPOS`, `ZPL`, `TSPL`, `RAW` |
| Loại máy in | `A4`, `A5`, `K80`, `K58`, `BARCODE` |
| Lưu cấu hình | `chrome.storage.local` (cấu hình), IndexedDB (lịch sử job, payload tạm). KHÔNG dùng `chrome.storage.sync`. |

## 2. Giới hạn của Chrome (đã tra nguồn)

| # | Giới hạn | Trạng thái | Hệ quả cho thiết kế |
|---|---|---|---|
| L1 | `chrome.printing` chỉ có trên ChromeOS. | FACT | Không liệt kê, không chọn máy in hệ điều hành trên Windows/macOS/Linux. `getPrinters()` trả về **printer profile** do người dùng tạo. |
| L2 | `window.print()` luôn mở hộp thoại in và không chọn được máy in. | FACT | PDF/HTML đi qua hộp thoại in của Chrome. Người dùng chọn máy in trong hộp thoại. |
| L3 | Chrome không báo người dùng đã bấm In hay Huỷ. | FACT | Job PDF/HTML kết thúc ở `UNKNOWN` + `PRINT_DIALOG_CLOSED`. |
| L4 | Cờ `--kiosk-printing` bỏ qua hộp thoại và in ra máy in mặc định của hệ điều hành. | FACT trên Windows. UNKNOWN trên Linux. Một nhà cung cấp nói macOS không hỗ trợ. | Đây là cấu hình triển khai do quản trị viên chọn. Extension không giả lập tính năng này. |
| L5 | WebUSB có trong service worker của extension từ Chrome 118. `requestDevice()` không gọi được trong service worker. | FACT (Chrome docs) | Người dùng cấp quyền thiết bị ở trang options. Service worker dùng `getDevices()`. `minimum_chrome_version = 118`. |
| L6 | Web Serial trong service worker. | UNKNOWN (MDN: chỉ có ở Dedicated Worker) | Nếu service worker không có `navigator.serial`, job chạy trong cửa sổ phụ `print.html`. |
| L7 | Match pattern không ghi port thì khớp mọi port. | FACT (Chrome docs) | Service worker PHẢI so khớp origin chính xác, kể cả port. |
| L8 | `externally_connectable` chỉ nhận danh sách URL tĩnh trong manifest. | FACT | Không dùng `externally_connectable`. Dùng content script đăng ký động theo từng origin. |

## 3. Kiến trúc

```
ReactJS app
  └─ @xdev/browser-print (SDK)               window.postMessage (cùng origin)
       └─ Content script (relay, không có quyền)  chrome.runtime port "xdbp-bridge"
            └─ Service worker
                 ├─ PageApi        xác thực origin + scope, chống replay
                 ├─ JobManager     idempotency, rate limit, queue theo máy in, retry
                 ├─ Router         documentType → mapping → printer profile
                 └─ Adapter registry
                      ├─ BrowserPrintAdapter → cửa sổ print.html → hộp thoại in Chrome
                      ├─ WebUsbPrintAdapter  → navigator.usb (trong service worker)
                      └─ WebSerialPrintAdapter → navigator.serial (service worker hoặc print.html)
                                                     └─ Máy in vật lý
```

| Thành phần | File | Trách nhiệm |
|---|---|---|
| Shared types | `packages/shared-types/src` | Kiểu dữ liệu, mã lỗi, protocol. Là hợp đồng giữa SDK và extension. |
| Core | `packages/core/src` | Logic thuần: kiểm tra origin, cấu hình, router, state machine, rate limit, replay guard, bộ mã hoá ESC/POS/ZPL/TSPL, PDF in thử. |
| Service worker | `apps/extension/src/background` | Ghép các thành phần, nhận message, quản lý site và cửa sổ duyệt. |
| Content script | `apps/extension/src/content/index.ts` | Chuyển message giữa trang và service worker. Không giữ quyền. |
| Print runner | `apps/extension/src/print` | Hiển thị tài liệu và gọi hộp thoại in. Chạy job RAW khi service worker thiếu API. |
| Admin UI | `apps/extension/src/options`, `popup`, `approve` | 8 màn hình quản trị, popup, cửa sổ duyệt. |
| SDK | `packages/browser-print-sdk/src` | Class `XDevBrowserPrint`, hook `useBrowserPrint`. |

## 4. Luồng chính

### 4.1 Cho phép một website (ghép nối)

1. Người dùng nhập origin ở màn hình **Website**, hoặc bấm **Cho phép website này** trong popup.
2. Trang extension gửi `sites.pending` tới service worker. Lý do: popup có thể đóng khi Chrome hiện hộp thoại quyền.
3. Trang extension gọi `chrome.permissions.request` với match pattern của host.
4. Service worker nhận `permissions.onAdded` hoặc `sites.add`. Service worker lưu `SiteGrant` cho **origin chính xác** và gọi `chrome.scripting.registerContentScripts`.
5. Service worker chèn content script vào các tab đang mở của host đó.

Kết quả: chỉ origin được cho phép mới có content script. Manifest không khai báo `content_scripts` tĩnh.

### 4.2 Kết nối từ SDK (`connect()`)

1. SDK gửi `hello`. Content script trả `ready` kèm `extensionId`.
2. SDK gửi `connect` với các scope cần dùng.
3. Nếu grant đã có đủ scope, service worker trả kết quả ngay.
4. Nếu thiếu scope, service worker mở cửa sổ `approve.html`. Người dùng cho phép hoặc từ chối. Sau 2 phút không trả lời, yêu cầu bị từ chối.
5. Origin chưa có grant và bị từ chối → lỗi `PAIRING_REJECTED`.

### 4.3 In một tài liệu

1. SDK chuyển dữ liệu nhị phân sang base64 và gửi `print` kèm `idempotencyKey`.
2. Service worker kiểm tra origin, scope `print`, `requestId`, `sentAt`.
3. JobManager kiểm tra định dạng và kích thước, rồi tìm job cùng `idempotencyKey`. Nếu có job trùng → trả job cũ với `duplicate: true` và không in lại.
4. JobManager kiểm tra rate limit theo origin.
5. Router chọn printer profile theo thứ tự: `printerId` → mapping của `documentType` → profile mặc định tương thích.
6. Router từ chối định dạng không khớp adapter. Ví dụ: `ZPL` tới máy `browser` → `UNSUPPORTED_FORMAT`.
7. JobManager lưu payload vào IndexedDB, chuyển job sang `QUEUED` và trả `jobId`.
8. JobManager ghi `DISPATCHING` vào IndexedDB **trước** khi gửi tới thiết bị.
9. Adapter in. JobManager ghi trạng thái cuối và xoá payload.
10. SDK nhận event `job`. Nếu mất event, SDK hỏi `getJobStatus` mỗi 2 giây.

## 5. Trạng thái job

| Trạng thái | Ý nghĩa |
|---|---|
| `CREATED` | Job vừa tạo. |
| `VALIDATING` | Đang kiểm tra dữ liệu và định tuyến. |
| `WAITING_PERMISSION` | Site bật "Hỏi xác nhận mỗi lần in". Đang chờ người dùng. |
| `QUEUED` | Đang chờ trong hàng đợi của máy in. Chưa gửi byte nào. |
| `DISPATCHING` | Đang gửi tới thiết bị hoặc hộp thoại in. |
| `SUBMITTED` | Thiết bị đã nhận đủ byte (`BYTES_WRITTEN_TO_DEVICE` / `BYTES_WRITTEN_TO_PORT`). Không có nghĩa giấy đã ra. |
| `UNKNOWN` | Không biết job có in hay không. Ví dụ: `PRINT_DIALOG_CLOSED`, `INTERRUPTED_DURING_DISPATCH`, `DISPATCH_TIMEOUT`. |
| `FAILED` | Job lỗi. Xem `errorCode`. |
| `CANCELLED` | Job bị huỷ trước khi gửi. |

Hệ thống KHÔNG có trạng thái `COMPLETED`. Lý do: không nguồn nào báo giấy đã ra một cách tin cậy.

Chuyển trạng thái hợp lệ (`packages/core/src/job-machine.ts`):

```
CREATED → VALIDATING → QUEUED → DISPATCHING → SUBMITTED | UNKNOWN | FAILED
                    ↘ WAITING_PERMISSION → QUEUED | CANCELLED
QUEUED → CANCELLED
DISPATCHING → QUEUED   (chỉ khi retry và chưa gửi byte nào)
```

### 5.1 Retry và chống in trùng

| Điều kiện | Hành động |
|---|---|
| Lỗi trước khi gửi byte nào (không tìm thấy thiết bị, thiết bị bận, mở cổng lỗi) | Retry. Tối đa 3 lần gửi (2 lần retry). Chờ 1 s trước lần 2, 3 s trước lần 3. |
| Đã gửi một phần byte rồi lỗi | `FAILED` + `PARTIAL_TRANSFER`. KHÔNG retry. |
| Adapter quá thời gian hoặc throw | `UNKNOWN`. KHÔNG retry. |
| Service worker restart khi job ở `QUEUED` | Gửi tiếp. |
| Service worker restart khi job ở `DISPATCHING` | `UNKNOWN` + `INTERRUPTED_DURING_DISPATCH`. KHÔNG gửi lại. |
| Service worker restart khi cửa sổ in vẫn mở | Giữ `DISPATCHING`. Cửa sổ in báo kết quả sau. |

Lý do: một đơn thuốc hay tem bệnh nhân in trùng gây hại hơn một bản bị thiếu. Người dùng có thể in lại thủ công.

Thời gian chờ tối đa của mỗi lần gửi: `browser` 15 phút, `webusb` 60 s, `webserial` 60 s.

## 6. Adapter

Interface chung (`apps/extension/src/adapters/types.ts`):

```ts
interface PrintAdapter {
  readonly id: AdapterType;
  isSupported(): Promise<boolean>;
  getCapabilities(): Promise<PrinterCapabilities>;
  print(request: PrintRequest): Promise<PrintResult>;
  getStatus(profile?: PrinterProfile): Promise<PrinterStatus>;
}
```

| Adapter | Định dạng | Không cần hộp thoại | Chọn được máy in | Nơi chạy |
|---|---|---|---|---|
| `browser` | PDF, HTML | Không (chỉ có với `--kiosk-printing`) | Không, người dùng chọn trong hộp thoại | Cửa sổ `print.html` |
| `webusb` | ESCPOS, ZPL, TSPL, RAW | Có | Có (vendorId/productId/serialNumber) | Service worker. Cửa sổ phụ nếu thiếu API. |
| `webserial` | ESCPOS, ZPL, TSPL, RAW | Có | Có (usbVendorId/usbProductId/index) | Service worker nếu có API, nếu không thì cửa sổ phụ |

### 6.1 BrowserPrintAdapter

- PDF: tạo Blob URL trong trang extension, nạp vào iframe, gọi `print()` trên iframe.
- HTML: làm sạch bằng DOMPurify. Đặt vào iframe `sandbox="allow-same-origin allow-modals"` (không có `allow-scripts`). Thêm `@page` theo khổ giấy và lề của profile.
- Số bản (copies): HTML lặp nội dung với ngắt trang. PDF không đặt trước được số bản. Cửa sổ in hiện số bản yêu cầu để người dùng chọn.
- Cửa sổ in giữ port `xdbp-keepalive` và ping mỗi 20 s để service worker không bị dừng khi người dùng đang ở hộp thoại.
- Người dùng đóng cửa sổ trước khi hộp thoại mở → `FAILED` + `PRINT_WINDOW_CLOSED`. Đóng sau khi hộp thoại mở → `UNKNOWN`.

### 6.2 WebUsbPrintAdapter

1. Tìm thiết bị đã cấp quyền bằng `getDevices()`.
2. Mở thiết bị. Chọn configuration 1 nếu chưa có.
3. Chọn interface lớp máy in (class 7) có endpoint bulk OUT. Nếu không có, chọn interface bất kỳ có bulk OUT.
4. `claimInterface`. Lỗi ở bước này → `DEVICE_BUSY` (driver hệ điều hành đang giữ interface).
5. Gửi dữ liệu theo khối 16 KB.
6. Luôn `releaseInterface` và `close` trong `finally`.

### 6.3 WebSerialPrintAdapter

1. Tìm cổng đã cấp quyền bằng `getPorts()` theo USB id và chỉ số.
2. Mở cổng với `baudRate`, `dataBits`, `stopBits`, `parity`, `flowControl` của profile.
3. Ghi dữ liệu và chờ `writer.ready`.
4. Luôn đóng cổng.

`InvalidStateError` khi mở → `DEVICE_BUSY`. Web Serial không trả số byte đã ghi khi lỗi. Vì vậy lỗi sau khi bắt đầu ghi → `PARTIAL_TRANSFER`, không retry.

### 6.4 Chuẩn bị byte RAW

- Văn bản được mã hoá theo `encoding` của profile: `utf-8`, `latin1` hoặc `ascii`. Với `ascii`, tiếng Việt bỏ dấu (`Đơn thuốc` → `Don thuoc`).
- `ESCPOS` + `autoCut = true`: thêm lệnh cắt nếu cuối dữ liệu chưa có `GS V`.
- `copies` > 1: lặp toàn bộ dữ liệu.

## 7. Cấu hình

```json
{
  "schemaVersion": 1,
  "profiles": [{ "id": "printer-k80", "name": "Máy in hoá đơn", "adapter": "webusb", "category": "K80",
                 "paperSize": "K80", "orientation": "portrait", "copies": 1,
                 "marginsMm": { "top": 0, "right": 0, "bottom": 0, "left": 0 },
                 "encoding": "ascii", "autoCut": true,
                 "device": { "kind": "usb", "vendorId": 1046, "productId": 20497 } }],
  "mappings": { "INVOICE": { "documentType": "INVOICE", "printerId": "printer-k80", "copies": 2 } },
  "settings": { "language": "vi", "maxJobBytes": 15728640, "rateLimitJobs": 20, "rateLimitWindowMs": 60000,
                "historyLimit": 500, "allowSiteConfigure": true, "allowLocalhost": true }
}
```

Quy tắc kiểm tra (`packages/core/src/config.ts`):

| Trường | Quy tắc |
|---|---|
| `id` | `^[a-z0-9][a-z0-9_-]{0,63}$` |
| `documentType` | `^[A-Z][A-Z0-9_]{0,63}$` |
| `paperSize` | `A4`, `A5`, `K80`, `K58` hoặc `<rộng>x<cao>` theo mm, ví dụ `50x30` |
| `copies` | Số nguyên 1–20 |
| `marginsMm` | 0–100 mm mỗi cạnh |
| `barcodeDensity` | 6, 8, 12, 24 dpmm |
| `device` | Bắt buộc với `webusb` và `webserial` |
| `serial.baudRate` | 300–4 000 000 |

Mỗi loại máy in chỉ có một profile mặc định. Không xoá được profile đang được mapping dùng. Dữ liệu cấu hình hỏng bị bỏ khi đọc, extension vẫn chạy với phần hợp lệ.

## 8. Giao diện quản trị

| Màn hình | Chức năng |
|---|---|
| Tổng quan | Phiên bản, hệ điều hành, số site, profile, mapping, job đang chạy. Bảng khả năng adapter. Giới hạn của Chrome. |
| Máy in | Thêm, sửa, xoá printer profile. Hiện trạng thái sẵn sàng. |
| Gán chứng từ | Gán `documentType` cho profile, ghi đè khổ giấy, hướng giấy, số bản. |
| Thiết bị | Cấp và thu hồi quyền WebUSB, Web Serial. |
| In thử | In thử PDF, HTML, ESC/POS (K80/K58), ZPL, TSPL. |
| Lịch sử in | Thông tin job: thời gian, site, chứng từ, định dạng, kích thước, máy in, trạng thái. Không có nội dung tài liệu. |
| Website | Thêm origin, chọn scope, bật xác nhận từng lệnh in, thu hồi. |
| Cài đặt | Ngôn ngữ (mặc định tiếng Việt), giới hạn dung lượng, rate limit, số dòng lịch sử, cho phép site đổi mapping, cho phép localhost. |

## 9. Quyết định thiết kế

| Quyết định | Lý do | Đánh đổi |
|---|---|---|
| Content script đăng ký động thay cho `externally_connectable` | Origin do người dùng thêm lúc chạy. `externally_connectable` chỉ nhận danh sách tĩnh. | Cần quyền host theo từng site. Trang phải tải lại nếu đã mở trước khi cấp quyền (đã giảm bằng cách chèn script vào tab đang mở). |
| Mọi thay đổi cấu hình đi qua service worker, có hàng đợi | `chrome.storage` không có transaction. | Trang options phải gửi message thay vì ghi trực tiếp. |
| Payload lưu IndexedDB, xoá khi job kết thúc | Message của Chrome là JSON. Cửa sổ in cần đọc file lớn. | Payload nằm trên đĩa trong lúc job chạy. |
| Một hàng đợi cho mỗi printer profile | Hai job không được trộn byte trên một thiết bị. | Các job trên cùng máy in chạy tuần tự. |
| HTML của site hiển thị trong iframe sandbox sau khi làm sạch | Không để mã của site chạy với quyền extension. | Mất script và form trong tài liệu in. Tài liệu in PHẢI là HTML tĩnh. |
