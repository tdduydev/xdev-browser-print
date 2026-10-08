# xDev Browser Print

Chrome Extension (Manifest V3) và SDK TypeScript để website ReactJS in đơn thuốc, hoá đơn, tem nhãn tới máy in cấu hình theo loại chứng từ. Không cần backend, ứng dụng native hay cloud print.

| Thư mục | Nội dung |
|---|---|
| `apps/extension` | Extension: service worker, content script, giao diện quản trị, cửa sổ in |
| `packages/browser-print-sdk` | SDK `@xdev/browser-print` và hook `useBrowserPrint` |
| `packages/core` | Logic dùng chung: origin, cấu hình, router, trạng thái job, bộ mã hoá |
| `packages/shared-types` | Kiểu dữ liệu và protocol |
| `tests/e2e` | Playwright e2e trên Chromium thật |
| `docs` | Tài liệu thiết kế |

## Lệnh

```bash
pnpm install
pnpm lint && pnpm typecheck
pnpm test          # unit + integration
pnpm test:e2e      # e2e (lần đầu: pnpm exec playwright install chromium)
pnpm build         # apps/extension/dist + packages/browser-print-sdk/dist
```

Cài thử extension: mở `chrome://extensions`, bật Developer mode, chọn **Load unpacked** → `apps/extension/dist`.

## Tài liệu

- [Thiết kế tính năng](docs/ARCHITECTURE.md)
- [API của SDK](docs/API.md)
- [Bảo mật](docs/SECURITY.md)
- [Kiểm thử](docs/TESTING.md)
- [Ma trận tương thích](docs/COMPATIBILITY.md)

## Giới hạn quan trọng

- Chrome trên Windows/macOS/Linux không cho extension liệt kê hoặc chọn máy in hệ điều hành. PDF/HTML luôn qua hộp thoại in.
- Chrome không báo người dùng đã in hay huỷ. Job PDF/HTML kết thúc ở `UNKNOWN` + `PRINT_DIALOG_CLOSED`.
- In trực tiếp không hộp thoại chỉ có với máy in nhận lệnh RAW qua WebUSB/Web Serial, hoặc khi quản trị viên chạy Chrome với `--kiosk-printing`.
