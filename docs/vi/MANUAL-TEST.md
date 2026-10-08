# Checklist test thủ công (BP-13)

Bản tiếng Anh: [../MANUAL-TEST.md](../MANUAL-TEST.md)

Chạy checklist này trên máy và máy in thật. Một thiết bị chỉ được nâng lên **Verified on Physical Printer** trong [COMPATIBILITY.md](COMPATIBILITY.md) khi có biên bản đã điền (cuối trang) và ảnh bản in. Kết quả mock hoặc headless không tính.

Quy ước: kết quả là `PASS`, `FAIL` hoặc `N/A`. Mỗi `FAIL` thành một task lỗi riêng; không sửa code trong lúc test. Dùng bản extension cần kiểm, ghép với một trang test dùng SDK.

## Chuẩn bị (mọi nhóm)

- S1. Cài extension (unpacked hoặc zip release), mở giao diện quản trị, xác nhận service worker đang chạy.
- S2. Ghép một website https và cấp các scope nhóm đó cần.
- S3. Ghi OS, phiên bản Chrome, model máy in, firmware, driver vào biên bản.

## 1. Hộp thoại in (thiết bị: máy in văn phòng bất kỳ)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| PD-01 | S1–S2, máy in đã cài trong OS | Gửi toa thuốc HTML khổ A5 (`print` với `paper: A5`) | Cửa sổ in mở, hộp thoại hiện A5, nội dung không bị cắt, lề đúng thiết kế, số trang đúng, khổ giấy khớp bản xem trước |
| PD-02 | Như trên | Gửi hóa đơn PDF A4 | Hộp thoại hiện A4, đủ trang, font nhúng đúng, khổ giấy khớp |
| PD-03 | Như trên | Đóng hộp thoại, không in | Job kết thúc `UNKNOWN` kèm `PRINT_DIALOG_CLOSED`; cửa sổ in đóng |
| PD-04 | Như trên | Chọn máy in và in | Giấy ra; job tới trạng thái cuối; không còn cửa sổ thừa |
| PD-05 | Như trên | HTML chứa `<script>` và ảnh từ xa | Script không chạy; nội dung được làm sạch; trang vẫn in |

## 2. `--kiosk-printing` (thiết bị: máy Windows + máy in mặc định)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| KP-01 | Đóng hẳn Chrome, đã đặt máy in mặc định | Mở Chrome với `--kiosk-printing`, gửi nội dung PD-01 | Không hiện hộp thoại; in ra máy in mặc định; ghi lại trạng thái job SDK báo |
| KP-02 | Như trên | Đổi máy in mặc định, lặp lại | In ra máy in mặc định mới |
| KP-03 | macOS/Linux (tùy chọn) | Lặp lại KP-01 | Ghi lại có chạy không; ma trận hiện ghi UNKNOWN |

## 3. WebUSB ESC/POS (thiết bị: máy in nhiệt USB K80 và K58)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| EP-01 | Máy in cắm USB, driver đã chuẩn bị cho WebUSB | Ghép thiết bị từ giao diện quản trị / SDK | Thiết bị hiện với vendor/product ID; quyền còn sau khi khởi động lại trình duyệt |
| EP-02 | EP-01, K80 | In hóa đơn K80 (80 mm) | In đủ chiều rộng, không cụt dòng |
| EP-03 | EP-01, K58 | In hóa đơn K58 (58 mm) | Vừa khổ 58 mm, không lỗi xuống dòng |
| EP-04 | EP-02 | In với tùy chọn cắt giấy | Giấy được cắt sau hóa đơn |
| EP-05 | EP-02 | In chữ có dấu (`Phở bò, Nguyễn Thị Hương, Đà Nẵng`) | Mọi dấu đúng (đúng code page), không có `?` hay ký tự rác |
| EP-06 | EP-02 | In mã QR và mã vạch | Quét ra đúng cả hai |

## 4. WebUSB ZPL/TSPL (thiết bị: máy in tem)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| LB-01 | Đã ghép máy in tem, nạp tem 50×30 mm | In tem 50×30 mm (ZPL hoặc TSPL tùy model) | Tem canh đúng, không bị cắt, mỗi job một tem |
| LB-02 | LB-01 | In tem có mã vạch | Máy quét cầm tay đọc ra đúng giá trị |
| LB-03 | LB-01 | In 5 bản | Đúng 5 tem |
| LB-04 | LB-01 | In chữ tiếng Việt | Dấu đúng, hoặc ghi lại giới hạn |

## 5. Web Serial (thiết bị: máy in cổng serial hoặc USB-serial)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| WS-01 | Máy in trên cổng COM/serial | Ghép qua Web Serial, đặt baud rate | Cổng hiện trong danh sách và được nhớ |
| WS-02 | WS-01 | Lặp lại EP-02, EP-04, EP-05 qua serial | Kết quả như các case WebUSB |
| WS-03 | WS-01, máy in tem | Lặp lại LB-01, LB-02 qua serial | Kết quả như các case WebUSB |
| WS-04 | WS-01 | Sai baud rate | Ra ký tự rác hoặc job lỗi có thông báo rõ; ghi lại trường hợp nào |

## 6. Lỗi thiết bị

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| ER-01 | Đang chạy job in dài | Rút cáp USB giữa chừng | Job lỗi `DEVICE_DISCONNECTED` hoặc `TRANSFER_FAILED`; không treo; giao diện quản trị hiện lỗi |
| ER-02 | ER-01 | Cắm lại, in lại | Chạy được, ghép lại nếu cần; ghi lại có phải ghép lại không |
| ER-03 | Nắp máy in mở hoặc hết giấy | In | Ghi lại máy in phản ứng ra sao và trạng thái job báo gì |
| ER-04 | Windows, driver `usbprint.sys` mặc định đang giữ máy in | In qua WebUSB | Lỗi `DEVICE_BUSY`; thông báo chỉ ra cách xử lý |
| ER-05 | Thiết bị chưa ghép / đã gỡ | In tới mapping của nó | `DEVICE_NOT_FOUND` |

## 7. Quyền thật (không cần máy in)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| PM-01 | Một site https thật, đã cài extension | Ghép site | Hộp `chrome.permissions.request` hiện đúng origin; chấp nhận → ghép được |
| PM-02 | PM-01 | Từ chối hộp quyền | Ghép lỗi gọn gàng; không còn host permission sót lại |
| PM-03 | PM-01 | Thu hồi site trong giao diện quản trị | Site không in được nữa; host permission bị gỡ |
| PM-04 | PM-01 | In trước và sau khi cửa sổ duyệt hết hạn | Hành xử đúng như tài liệu API |

## Mẫu biên bản

Sao chép một bản cho mỗi thiết bị và OS.

```
Ngày:
Người test:
OS + phiên bản:
Phiên bản Chrome:
Phiên bản extension / commit:
Model máy in:
Kết nối (USB / serial / mạng):
Firmware / driver (và WinUSB/udev đã dùng):

Kết quả từng case (PASS / FAIL / N/A, ghi chú và ID task lỗi):
PD-01 .. PD-05:
KP-01 .. KP-03:
EP-01 .. EP-06:
LB-01 .. LB-04:
WS-01 .. WS-04:
ER-01 .. ER-05:
PM-01 .. PM-04:

Ảnh (bản in, kèm tên file):
Kết luận (nâng lên Verified on Physical Printer? có/không):
```
