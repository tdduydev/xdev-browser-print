# Ứng dụng React mẫu — xDev Browser Print

English: [README.md](README.md)

Ứng dụng Vite + React nhỏ, in qua extension bằng hook `useBrowserPrint` của `@xdev/browser-print/react`. Dùng làm ví dụ tích hợp chạy được; tài liệu SDK đầy đủ ở [docs/vi/API.md](../../docs/vi/API.md) (bản tiếng Anh: [docs/API.md](../../docs/API.md)).

## Nội dung

| Màn hình | `documentType` | Định dạng | Kết quả mong đợi |
|---|---|---|---|
| Đơn thuốc (A5) | `PRESCRIPTION` | `HTML` | Mở hộp thoại in của Chrome. Job kết thúc `UNKNOWN` / `PRINT_DIALOG_CLOSED`, vì Chrome không cho biết người dùng có in hay không. |
| Hóa đơn (K80) | `RECEIPT` | `ESCPOS` | Gửi byte thô tới máy in nhiệt qua WebUSB/Web Serial. `SUBMITTED` nghĩa là đã ghi hết byte. |
| Tem nhãn (50×30 mm) | `LABEL` | `ZPL` | Gửi ZPL thô tới máy in tem. |

Mỗi màn hình hiện trạng thái extension (`detecting`, `not-installed`, `ready`, `connected`, `error`), origin đã ghép nối và quyền, danh sách máy in, trạng thái và kết quả của job gần nhất, và mã lỗi SDK nếu lệnh gọi thất bại.

Mã nguồn: `src/App.tsx` (cách dùng hook), `src/documents.ts` (chứng từ mẫu).

## Chạy

```bash
# 1. Ở thư mục gốc repo
pnpm install
pnpm build                              # build apps/extension/dist và packages/browser-print-sdk/dist

# 2. Chạy demo ở http://localhost:5174 (cổng cố định: extension ghép nối theo origin chính xác)
pnpm --filter @xdev/react-demo dev
```

Demo import SDK đã build (`packages/browser-print-sdk/dist`). Sau khi sửa SDK, build lại bằng `pnpm --filter @xdev/browser-print build`.

## Cấu hình extension

1. Mở `chrome://extensions`, bật **Developer mode**, bấm **Load unpacked** và chọn `apps/extension/dist`.
2. Mở trang tùy chọn của extension:
   - **Máy in**: thêm một profile. Với đơn thuốc, profile A5 dùng adapter `browser` là đủ.
   - **Gán chứng từ**: gán `PRESCRIPTION` (và `RECEIPT`, `LABEL` nếu có máy in tương ứng) cho một profile.
   - **Website**: cho phép `http://localhost:5174` với quyền **Đọc cấu hình** và **In**. Chrome sẽ hỏi cấp quyền truy cập website đó.
   - **Cài đặt**: giữ bật **Cho phép localhost (môi trường phát triển)**.
3. Tải lại demo, bấm **Connect**, chọn chứng từ rồi bấm **Print**.

Nếu bỏ qua bước 2, demo hiện `not-installed` (origin này không có bridge), hoặc lỗi `MAPPING_NOT_FOUND` khi in loại chứng từ chưa được gán.

## Build và kiểm thử

```bash
pnpm --filter @xdev/react-demo build    # examples/react-demo/dist
pnpm test:e2e                           # gồm tests/e2e/react-demo.spec.ts: build demo, ghép nối, in một job HTML
```
