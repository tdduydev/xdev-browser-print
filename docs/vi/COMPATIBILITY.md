# Ma trận tương thích

Mức độ:

- **Implemented**: đã có code và test với mock/thiết bị giả.
- **Verified on Browser**: đã chạy đúng trên Chrome/Chromium thật (tự động hoặc thủ công).
- **Verified on Physical Printer**: đã in ra giấy trên máy in thật.

Không tính năng nào được nâng mức chỉ dựa vào mock test.

Cập nhật: 2026-10-08.

## Tính năng × hệ điều hành

| Tính năng | macOS | Windows 10/11 | Linux |
|---|---|---|---|
| Cài extension, service worker, giao diện quản trị | Verified on Browser (Chromium 156 headless, e2e) | Implemented (unit test đạt trên CI) | Verified on Browser (e2e trên CI, `ubuntu-latest`) |
| Ghép nối website, scope, cửa sổ duyệt, thu hồi | Verified on Browser (e2e) | Implemented | Verified on Browser (e2e trên CI) |
| Chống replay, trùng job, rate limit | Verified on Browser (e2e) | Implemented | Verified on Browser (e2e trên CI) |
| Service worker restart | Verified on Browser (e2e, CDP stop) | Implemented | Verified on Browser (e2e trên CI) |
| HTML → cửa sổ in (làm sạch, sandbox) | Verified on Browser (headless; hộp thoại chưa hiện) | Implemented | Verified on Browser (e2e trên CI) |
| PDF → cửa sổ in | Verified on Browser (headless; job tới trạng thái cuối) | Implemented | Verified on Browser (e2e trên CI) |
| Hộp thoại in Chrome, chọn máy in | Chưa kiểm | Chưa kiểm | Chưa kiểm |
| In không hộp thoại bằng `--kiosk-printing` | UNKNOWN (một nhà cung cấp nói không hỗ trợ) | Có tài liệu của bên thứ ba, chưa kiểm | UNKNOWN |
| WebUSB → ESC/POS (K80/K58) | Implemented | Implemented (thường cần driver WinUSB) | Implemented (cần udev rule, gỡ `usblp`) |
| WebUSB → ZPL/TSPL (tem) | Implemented | Implemented | Implemented |
| Web Serial → ESC/POS/ZPL/TSPL | Implemented | Implemented | Implemented |

Kết quả Linux lấy từ CI run 37777305750 (PR #2, 2026-10-08). Windows có unit test trên CI, chưa có e2e trình duyệt.

## Thiết bị đã xác minh

Chỉ thêm dòng sau khi có biên bản đã điền theo [MANUAL-TEST.md](MANUAL-TEST.md) kèm ảnh bản in.

| Model máy in | Loại | Kết nối | OS + Chrome | Case đạt | Driver / cấu hình | Ngày | Người test | Biên bản |
|---|---|---|---|---|---|---|---|---|
| _chưa có_ | | | | | | | | |

Chưa có thiết bị nào ở mức **Verified on Physical Printer**.

## Ghi chú theo hệ điều hành (chưa kiểm chứng trên máy thật)

| Hệ điều hành | Ghi chú |
|---|---|
| Windows | Driver `usbprint.sys` thường giữ interface máy in USB. Khi đó `claimInterface` lỗi → `DEVICE_BUSY`. Hướng xử lý thường gặp: cài WinUSB cho thiết bị (ví dụ bằng Zadig). Máy sẽ không in được qua driver Windows nữa. |
| Linux | Cần quyền udev cho thiết bị và gỡ driver `usblp` khỏi interface. |
| macOS | Hệ điều hành có thể giữ một số thiết bị. Cần kiểm thử theo model. |
