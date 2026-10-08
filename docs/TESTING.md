# Kiểm thử — xDev Browser Print

Ngày chạy: 2026-10-08 · Máy: macOS 27.0.1 · Node 26.10.0 · pnpm 10.34.6 · Chromium 156 (Playwright 1.64.0, build 1248, headless)

## 1. Kết quả

| Cấp | Công cụ | Số test | Kết quả |
|---|---|---|---|
| Unit — core | Vitest 3.2.7 (node) | 70 | 70 đạt |
| Unit + integration — extension | Vitest 3.2.7 (jsdom) | 54 | 54 đạt |
| Unit + integration — SDK | Vitest 3.2.7 (jsdom) | 18 | 18 đạt |
| E2E — extension thật trong Chromium | Playwright 1.64.0 | 16 | 16 đạt |
| Lint | ESLint 9.39.5 | — | 0 lỗi |
| Typecheck (gồm cả file test) | TypeScript 5.9.3 strict | — | 0 lỗi |

Kiểm tra chất lượng của bộ test: mình cố ý gây 2 lỗi trong code (bỏ rate limit; cho job `DISPATCHING` được gửi lại sau restart). Bộ test báo 3 test lỗi đúng chỗ. Sau khi trả code về như cũ, toàn bộ test đạt.

Chưa đo coverage (chưa cài `@vitest/coverage-v8`).

## 2. Cách chạy

```bash
pnpm install
pnpm exec playwright install chromium   # lần đầu
pnpm lint
pnpm typecheck
pnpm test        # unit + integration (142 test)
pnpm test:e2e    # build SDK + extension bản e2e, rồi chạy Playwright (16 test)
```

## 3. Phạm vi các cấp test

| Cấp | Kiểm tra | Không kiểm tra |
|---|---|---|
| Unit | Logic thuần trong `packages/core`: origin, cấu hình, router, state machine, rate limit, replay, bộ mã hoá. | API của Chrome. |
| Integration | `JobManager` + `MemoryJobStore` + adapter giả. `PageApi` + `ConfigStore` + `JobManager`. Adapter WebUSB/Serial với thiết bị giả. SDK + bridge giả. | Chrome thật, thiết bị thật. |
| E2E | Extension build thật trong Chromium: service worker, content script, IndexedDB, `chrome.storage`, cửa sổ in, cửa sổ duyệt, giao diện quản trị. | Hộp thoại in thật (headless), máy in vật lý, WebUSB/Serial thật. |

## 4. Danh sách test case theo tính năng

### 4.1 Bảo mật website

| ID | Test case | Kết quả mong đợi | File |
|---|---|---|---|
| SEC-01 | Origin wildcard, có path, query, credentials, `file:`, `chrome-extension:` | Bị từ chối với mã đúng | `core/test/origin.test.ts` |
| SEC-02 | `http://localhost` khi tắt `allowLocalhost` | `ORIGIN_NOT_ALLOWED` | `core/test/origin.test.ts` |
| SEC-03 | Origin chưa được cho phép mở trang | `isInstalled() = false` (không có content script) | e2e |
| SEC-04 | Cùng host, khác port | `ORIGIN_NOT_ALLOWED` từ service worker | e2e |
| SEC-05 | Origin giả: `his.example.vn.evil.com`, `http://` thay `https://` | `ORIGIN_NOT_ALLOWED` | `extension/test/page-api.test.ts` |
| SEC-06 | Site chỉ có `read` gọi `print`, `saveMapping` | `PERMISSION_DENIED` | unit + e2e |
| SEC-07 | Site có `configure` nhưng cài đặt tắt `allowSiteConfigure` | `PERMISSION_DENIED` | `page-api.test.ts` |
| SEC-08 | `connect()` xin thêm scope → cửa sổ duyệt → Từ chối | Giữ scope cũ | e2e |
| SEC-09 | `connect()` xin thêm scope → Cho phép | Grant có scope mới | e2e |
| SEC-10 | Origin chưa có grant bị từ chối ghép nối | `PAIRING_REJECTED` | `page-api.test.ts` |
| SEC-11 | Scope tự đặt (`admin`) | Bị bỏ qua | `page-api.test.ts` |
| SEC-12 | Dùng lại `requestId`; `sentAt` lệch 5 phút | `REPLAY_DETECTED` | unit |
| SEC-13 | Request sai cấu trúc, method lạ | `INVALID_REQUEST`, không crash | `page-api.test.ts` |
| SEC-14 | Site B đọc hoặc huỷ job của site A | `JOB_NOT_FOUND` | `page-api.test.ts` |
| SEC-15 | Lỗi nội bộ có chứa dữ liệu bệnh nhân | Response không chứa chuỗi đó | `page-api.test.ts` |
| SEC-16 | `getPrinters()` | Không có `vendorId`, `serialNumber`, `baudRate` | `page-api.test.ts` |
| SEC-17 | Thu hồi site khi trang đang mở | Request tiếp theo bị từ chối | e2e |
| SEC-18 | HTML có `script`, `onerror`, `javascript:`, `iframe`, `form`, `svg/script`, `object`, `link`, `base` | Bị loại bỏ; nội dung tiếng Việt giữ nguyên | `render.test.ts` + e2e |
| SEC-19 | Iframe in | `sandbox="allow-same-origin allow-modals"`, không có `script` | e2e |
| SEC-20 | Message từ origin khác hoặc window khác tới SDK | Bị bỏ qua | `sdk/test/client.test.ts` |
| SEC-21 | `extensionId` được ghim, extension khác trả lời | Bị bỏ qua | `sdk/test/client.test.ts` |

### 4.2 Job, trùng lặp, spam

| ID | Test case | Kết quả mong đợi | File |
|---|---|---|---|
| JOB-01 | In ESC/POS theo mapping | `SUBMITTED`, lịch sử đủ 5 trạng thái, đúng `copies` của mapping | `job-manager.test.ts` |
| JOB-02 | In qua hộp thoại | `UNKNOWN` + `PRINT_DIALOG_CLOSED` | unit + e2e |
| JOB-03 | Gửi lại cùng `idempotencyKey` | Trả job cũ, `duplicate: true`, adapter chỉ được gọi 1 lần | unit + e2e |
| JOB-04 | Hai request cùng key gửi đồng thời | 1 thành công, 1 `REPLAY_DETECTED` | `job-manager.test.ts` |
| JOB-05 | Cùng key, khác origin | Hai job riêng | `job-manager.test.ts` |
| JOB-06 | Vượt rate limit | `RATE_LIMITED`; origin khác không bị ảnh hưởng | unit + e2e |
| JOB-07 | Payload vượt `maxJobBytes` | `PAYLOAD_TOO_LARGE`, không tạo job | `job-manager.test.ts` |
| JOB-08 | Dữ liệu không phải PDF gắn nhãn PDF | `INVALID_REQUEST` | unit + e2e |
| JOB-09 | Chứng từ chưa gán | `MAPPING_NOT_FOUND`, lịch sử ghi `FAILED` | unit + e2e |
| JOB-10 | ZPL tới máy `browser`; PDF tới máy `webusb` | `UNSUPPORTED_FORMAT` | unit + e2e |
| JOB-11 | Lỗi retry được (chưa gửi byte) rồi thành công | `SUBMITTED`, `attempts = 2` | `job-manager.test.ts` |
| JOB-12 | Lỗi retry được liên tục | `FAILED` sau `maxAttempts` | `job-manager.test.ts` |
| JOB-13 | Gửi được một phần | `FAILED` + `PARTIAL_TRANSFER`, không retry | `job-manager.test.ts` |
| JOB-14 | Adapter treo quá timeout | `UNKNOWN` + `DISPATCH_TIMEOUT`, không retry | `job-manager.test.ts` |
| JOB-15 | 3 job cùng máy in | Chạy tuần tự (tối đa 1 job cùng lúc) | `job-manager.test.ts` |
| JOB-16 | Site bật xác nhận; người dùng từ chối / đồng ý | `CANCELLED` / `SUBMITTED` | `job-manager.test.ts` |
| JOB-17 | Huỷ job `WAITING_PERMISSION`; huỷ job đã xong | `CANCELLED` / `INVALID_REQUEST` | `job-manager.test.ts` |
| JOB-18 | Lịch sử vượt `historyLimit` | Chỉ giữ số dòng cấu hình | `job-manager.test.ts` |
| JOB-19 | Lịch sử in | Không có nội dung tài liệu (unit: payload bị xoá; e2e: không có tên bệnh nhân trong dữ liệu và UI) | unit + e2e |

### 4.3 Service worker bị dừng / extension khởi động lại

| ID | Test case | Kết quả mong đợi | File |
|---|---|---|---|
| SW-01 | Restart khi job `DISPATCHING` và job khác `QUEUED` | Job 1 → `UNKNOWN` (không gửi lại); job 2 được gửi | `job-manager.test.ts` |
| SW-02 | Restart khi cửa sổ in vẫn mở | Job giữ `DISPATCHING`; kết quả của cửa sổ in được áp dụng; báo cáo trễ lần 2 bị bỏ qua | `job-manager.test.ts` |
| SW-03 | Dừng service worker thật bằng CDP `ServiceWorker.stopAllWorkers` | Worker mới khởi động (biến đánh dấu trong bộ nhớ đã mất); request tiếp theo thành công | e2e |
| SW-04 | SDK mất event | SDK hỏi trạng thái mỗi 2 s và nhận kết quả | `client.test.ts` |

### 4.4 USB / Serial (thiết bị giả)

| ID | Test case | Kết quả mong đợi |
|---|---|---|
| DEV-01 | Thiết bị có interface vendor và interface máy in | Chọn interface class 7; gửi khối 16 KB; release + close |
| DEV-02 | Không có thiết bị đã cấp quyền | `DEVICE_NOT_FOUND`, retry được |
| DEV-03 | Serial number không khớp | `DEVICE_NOT_FOUND` |
| DEV-04 | `claimInterface` lỗi (driver hệ điều hành giữ) | `DEVICE_BUSY`, vẫn close |
| DEV-05 | Rút USB giữa chừng | `PARTIAL_TRANSFER`, không retry, `bytesWritten = 16384` |
| DEV-06 | Rút USB trước byte đầu | `DEVICE_DISCONNECTED`, retry được |
| DEV-07 | Transfer treo | `TIMEOUT` |
| DEV-08 | Không có WebUSB | `UNSUPPORTED_CAPABILITY` |
| DEV-09 | Serial: mở với đúng tham số profile, ghi, đóng | `SUBMITTED` + `BYTES_WRITTEN_TO_PORT` |
| DEV-10 | Serial đang mở ở nơi khác | `DEVICE_BUSY` |
| DEV-11 | Serial lỗi khi đang ghi | `PARTIAL_TRANSFER`, không retry, vẫn đóng cổng |
| DEV-12 | Chọn cổng theo USB id và index | Đúng cổng |
| DEV-13 | `copies`, tự cắt giấy, mã hoá tiếng Việt `ascii` | Lặp dữ liệu; thêm `GS V` một lần; bỏ dấu |

File: `apps/extension/test/adapters.test.ts`. Các test này dùng thiết bị giả, nên chỉ chứng minh mức **Implemented**.

### 4.5 Giao diện quản trị (e2e)

| ID | Test case | Kết quả mong đợi |
|---|---|---|
| UI-01 | Mở trang options | Tiêu đề "Tổng quan" (tiếng Việt mặc định); 8 mục điều hướng đều hiện |
| UI-02 | Tạo profile A5 và gán `PRESCRIPTION` qua giao diện | Bảng hiện profile và mapping; cấu hình lưu đúng |
| UI-03 | Manifest | MV3, service worker dạng module, không có `content_scripts` tĩnh |

## 5. Chưa kiểm thử

| Hạng mục | Lý do | Task |
|---|---|---|
| Hộp thoại in thật, chọn máy in, giấy ra | Chromium headless không hiện hộp thoại in | BP-13 (thủ công) |
| `--kiosk-printing` | Cần Chrome có giao diện và máy in thật | BP-13 |
| WebUSB/Web Serial với máy in thật (K80, K58, tem) | Không có thiết bị trong môi trường CI | BP-13 |
| Windows và Linux | Mới chạy trên macOS | BP-12 (CI ma trận hệ điều hành) |
| Luồng `chrome.permissions.request` thật (hộp thoại quyền) | Playwright không bấm được hộp thoại của Chrome; bản e2e cấp quyền sẵn | BP-13 |
| Popup của extension | Chưa có e2e | BP-10 |
| Cài đặt `confirmEachJob` trên Chrome thật | Mới có integration test | BP-10 |
| Coverage | Chưa cài công cụ | BP-10 |
