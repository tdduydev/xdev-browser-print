# Checklist test thủ công (BP-13)

Bản tiếng Anh: [../MANUAL-TEST.md](../MANUAL-TEST.md)

Chạy checklist này trên máy và máy in thật. Một thiết bị chỉ được nâng lên **Verified on Physical Printer** trong [COMPATIBILITY.md](COMPATIBILITY.md) khi có biên bản đã điền (cuối trang) và ảnh bản in. Kết quả mock hoặc headless không tính.

Quy ước:

- Kết quả là `PASS`, `FAIL` hoặc `N/A`. Mỗi `FAIL` thành một task lỗi riêng; không sửa code trong lúc test.
- Nhãn giao diện ghi dạng **Nhãn tiếng Việt** (*nhãn tiếng Anh*). Ngôn ngữ giao diện quản trị đặt ở **Cài đặt → Ngôn ngữ** (*Settings → Language*); mặc định là tiếng Việt.
- Kết quả job đọc ở hai chỗ: giá trị trả về trong console DevTools (Phụ lục A) và **Lịch sử in** (*Print history*), cột **Trạng thái** (*State*) và **Kết quả** (*Outcome*, cột này cũng hiện `errorCode: message`).
- Trạng thái job là một trong `SUBMITTED`, `UNKNOWN`, `FAILED`, `CANCELLED` (cuối) hoặc `CREATED`, `VALIDATING`, `WAITING_PERMISSION`, `QUEUED`, `DISPATCHING` (đang xử lý). `SUBMITTED` nghĩa là thiết bị hoặc cổng đã nhận byte, không có nghĩa là giấy đã ra.
- Không có trang test SDK kèm tài liệu mẫu. Các case dùng màn hình **In thử** (*Test print*) của trang quản trị, hoặc helper console và payload mẫu ở các phụ lục.

## Chuẩn bị (mọi nhóm)

- **S1.** Cài extension (unpacked hoặc zip release). Trang quản trị tự mở khi cài lần đầu; nếu không, mở từ popup trên thanh công cụ, **Mở trang quản trị** (*Open admin page*). Trong `chrome://extensions` xác nhận service worker đang chạy. Ghi phiên bản hiện ở **Tổng quan** (*Dashboard*).
- **S2.** Cho phép website test (một trang bất kỳ trên origin `https` thật do bạn quản lý): **Website** (*Websites*) → nhập đúng origin → tích **Đọc cấu hình** (*Read configuration*) và **In** (*Print*) → **Cho phép website** (*Allow website*) → chấp nhận hộp thoại cấp quyền của Chrome. Origin hiện trong danh sách. (Luồng này được test riêng ở PM-01.)
- **S3.** Ghi OS, phiên bản Chrome, model máy in, firmware, driver vào biên bản.
- **S4.** Tạo cấu hình máy in ở **Máy in** (*Printers*) → **Thêm** (*Add*), rồi gán loại chứng từ ở **Gán chứng từ** (*Document mapping*). Chọn **Loại máy in** (*Printer type*) sẽ điền giá trị mặc định (kiểu kết nối, khổ giấy, lề; K80/K58 bật luôn **Tự cắt giấy**). Mọi cấu hình mới bắt đầu với **Mã hoá ký tự** (*Text encoding*) = `ascii`. Cấu hình USB và serial cần cấp quyền thiết bị trước (EP-01 / WS-01).

  | Mã cấu hình | Loại máy in | Kiểu kết nối | Khổ giấy | Ghi chú | Loại chứng từ gán |
  |---|---|---|---|---|---|
  | `printer-a5` | A5 | Hộp thoại in Chrome (PDF/HTML) | `A5` | lề 8 mm (mặc định) | `PRESCRIPTION` |
  | `printer-a4` | A4 | Hộp thoại in Chrome (PDF/HTML) | `A4` | lề 10 mm (mặc định) | `INVOICE` |
  | `printer-k80` | K80 | WebUSB (lệnh RAW) | `K80` | thiết bị từ EP-01, bật Tự cắt giấy | `RECEIPT` |
  | `printer-k58` | K58 | WebUSB (lệnh RAW) | `K58` | thiết bị từ EP-01, bật Tự cắt giấy | `RECEIPT_K58` |
  | `printer-label` | BARCODE | WebUSB (lệnh RAW) | `50x30` | **Mật độ điểm** (*Dot density*) khớp máy in (8 = 203 dpi) | `SPECIMEN_LABEL` |
  | `printer-serial` | K80 hoặc BARCODE | Web Serial (lệnh RAW) | theo máy in | thiết bị và **Baud rate** từ WS-01 | `SERIAL_TEST` |

- **S5.** Mở DevTools trên một trang của website đã cho phép và dán helper ở Phụ lục A. Chạy `await xp('connect', { scopes: ['read', 'print'], sdkVersion: 'manual' })`; kết quả phải có origin và scope `["read","print"]`.

## 1. Hộp thoại in (thiết bị: máy in văn phòng bất kỳ)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| PD-01 | S1–S5, máy in đã cài trong OS, `printer-a5` gán cho `PRESCRIPTION` | Kiểm nhanh: **In thử** → chọn `printer-a5` → **In thử HTML** (*Test HTML*). Sau đó gửi toa thuốc A5 ở Phụ lục B.1 (`print` với `format: 'HTML'`, `documentType: 'PRESCRIPTION'`; khổ giấy lấy từ cấu hình máy in, `print()` không có tuỳ chọn khổ giấy) | Cửa sổ in mở rồi tới hộp thoại của Chrome. Bản xem trước khổ A5 (148×210 mm), nội dung không bị cắt, lề 8 mm, tiếng Việt đúng, số trang như mong đợi, giấy khớp bản xem trước |
| PD-02 | Như trên, `printer-a4` gán cho `INVOICE` | Kiểm nhanh: **In thử** → `printer-a4` → **In thử PDF** (*Test PDF*) (một trang A4, chữ sinh tự động, không dấu). Sau đó gửi một hoá đơn PDF A4 nhiều trang thật bằng Phụ lục B.2 (`documentType: 'INVOICE'`) | Hộp thoại hiện A4, đủ trang, font hiển thị như PDF gốc, giấy khớp. PDF dùng khổ trang của chính nó; khổ giấy và lề trong cấu hình không áp cho PDF |
| PD-03 | Như trên | (a) Gửi nội dung PD-01 rồi bấm **Huỷ** (*Cancel*) trong hộp thoại. (b) Gửi lại và đóng cửa sổ in nhỏ ("Đang in – xDev Browser Print") ngay khi nó hiện, trước khi hộp thoại hiện | (a) Job kết thúc `UNKNOWN`, outcome `PRINT_DIALOG_CLOSED`; cửa sổ in tự đóng sau khoảng 1,5 giây; `xprint` trả về bình thường (không lỗi). (b) Job kết thúc `FAILED`, outcome và `errorCode` là `PRINT_WINDOW_CLOSED`. Nếu hộp thoại đã kịp mở, job kết thúc `UNKNOWN` với outcome `PRINT_WINDOW_CLOSED`; ghi lại trường hợp nào xảy ra |
| PD-04 | Như trên | Gửi nội dung PD-01, chọn máy in và in | Giấy ra. Job kết thúc `UNKNOWN`, outcome `PRINT_DIALOG_CLOSED` (giống khi huỷ: Chrome không báo người dùng có in hay không). Không còn cửa sổ thừa |
| PD-05 | Như trên | Gửi Phụ lục B.3 (HTML có `<script>`, `onclick` inline và `<img>` từ xa) với `PRESCRIPTION` | Script không chạy (không có `alert`, tiêu đề không đổi); trang vẫn in. Ghi lại ảnh từ xa có tải và hiện trong bản xem trước hay không |

## 2. `--kiosk-printing` (thiết bị: máy Windows + máy in mặc định)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| KP-01 | Đóng hẳn Chrome (không còn tiến trình nền), đã đặt máy in mặc định của OS | Mở Chrome với `--kiosk-printing`, gửi nội dung PD-01 (hoặc **In thử HTML** trên `printer-a5`) | Không hiện hộp thoại; in ra máy in mặc định. Ghi lại trạng thái và outcome của job (theo code: `UNKNOWN` / `PRINT_DIALOG_CLOSED`) |
| KP-02 | Như trên | Đổi máy in mặc định, mở lại Chrome với cờ, lặp lại | In ra máy in mặc định mới |
| KP-03 | macOS/Linux (tuỳ chọn) | Lặp lại KP-01 | Ghi lại có chạy không; ma trận hiện ghi UNKNOWN |

## 3. WebUSB ESC/POS (thiết bị: máy in nhiệt USB K80 và K58)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| EP-01 | Máy in cắm USB; trên Windows đã cài driver WinUSB, trên Linux đã có udev rule và gỡ `usblp` | 1. **Thiết bị** (*Devices*) → **Cấp quyền thiết bị USB…** (*Grant a USB device…*) → chọn máy in trong hộp chọn của Chrome. 2. **Máy in** → sửa `printer-k80` → **Thiết bị** (*Device*) → chọn trong **Chọn thiết bị đã cấp quyền…** (*Pick a granted device…*) → **Lưu** (*Save*). 3. Ở **Gán chứng từ** gán `RECEIPT` → `printer-k80`. 4. Khởi động lại Chrome, mở lại **Thiết bị** và **Máy in** | Thiết bị hiện kèm `vendorId:productId` (và số serial nếu thiết bị có). **Trạng thái** là **Sẵn sàng** (*Ready*). Sau khi khởi động lại, thiết bị vẫn trong danh sách và cấu hình vẫn **Sẵn sàng** |
| EP-02 | EP-01, K80 | **In thử** → `printer-k80` → **In thử hoá đơn K80/K58 (ESC/POS)** (*Test receipt K80/K58 (ESC/POS)*). Sau đó gửi Phụ lục C.1 với `RECEIPT` | Hoá đơn in đủ khổ, dòng phân cách dài 48 ký tự và không bị xuống dòng, không dòng nào bị cắt. Job kết thúc `SUBMITTED`, outcome `BYTES_WRITTEN_TO_DEVICE`. Với `ascii`, dòng tiêu đề của hoá đơn in thử hiện `?` thay cho `·` (đã biết, xem EP-05) |
| EP-03 | EP-01 cho K58 (`printer-k58`, gán `RECEIPT_K58`) | Như EP-02 trên `printer-k58` | Dòng phân cách dài 32 ký tự và vừa khổ 58 mm, không lỗi xuống dòng |
| EP-04 | EP-02 | 1. Bật **Tự cắt giấy** (*Auto cut*), chạy **In thử hoá đơn** và gửi Phụ lục C.1. 2. Tắt **Tự cắt giấy**, lưu, lặp lại cả hai. 3. Bật **Tự cắt giấy**, gửi Phụ lục C.1 với `cut: true` (payload đã kết thúc bằng lệnh cắt) | 1. Giấy được cắt sau mỗi hoá đơn: khi bật Tự cắt giấy, extension nối thêm lệnh đẩy giấy + cắt (`ESC d 3`, `GS V 65 3`) vào job ESC/POS, kể cả hoá đơn in thử. 2. Không cắt. 3. Cắt đúng một lần (không nối thêm lệnh cắt khi payload đã kết thúc bằng `GS V`) |
| EP-05 | EP-02 | Gửi Phụ lục C.2 (chuỗi `Phở bò, Nguyễn Thị Hương, Đà Nẵng` dạng payload ESC/POS text) ba lần, mỗi lần đổi **Mã hoá ký tự** của cấu hình thành `ascii`, `utf-8`, `latin1` | `ascii`: in ra chữ không dấu: `Pho bo, Nguyen Thi Huong, Da Nang`. `utf-8`: tuỳ firmware; ghi chính xác những gì in ra (chụp ảnh). `latin1`: phần lớn chữ tiếng Việt thành `?`; ghi lại. Dòng `Tieng Viet: Đơn thuốc - Hóa đơn` của hoá đơn in thử cũng theo quy tắc này. **Thiếu sót đã biết:** chưa có tuỳ chọn code page tiếng Việt (chỉ có `utf-8`, `ascii`, `latin1`); in đúng dấu trên máy không hỗ trợ UTF-8 cần làm thêm |
| EP-06 | EP-02 | Mã vạch: **In thử hoá đơn** có in mã vạch CODE128. QR: tuỳ chọn, Phụ lục C.3 | Mã vạch quét ra `XDEV-TEST-001`. QR: extension không có bộ tạo QR; Phụ lục C.3 gửi byte thô kiểu Epson `GS ( k` do người test tự cung cấp. Ghi PASS/FAIL theo từng máy in, hoặc `N/A` nếu không chạy |

## 4. WebUSB ZPL/TSPL (thiết bị: máy in tem)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| LB-01 | Máy in tem đã cấp quyền và gắn vào `printer-label` (các bước như EP-01), đã lắp tem 50×30 mm, đã gán `SPECIMEN_LABEL` | **In thử** → `printer-label` → **In thử tem (ZPL)** (*Test label (ZPL)*) hoặc **In thử tem (TSPL)** (*Test label (TSPL)*) theo model. Sau đó gửi Phụ lục D.1 (ZPL) hoặc D.2 (TSPL) | Tem thẳng hàng, không bị cắt, mỗi job một tem. Job kết thúc `SUBMITTED` |
| LB-02 | LB-01 | Quét mã vạch của từng tem bằng máy quét cầm tay | Tem in thử ra `XDEV-TEST-001`; tem Phụ lục D ra `SPEC0001` |
| LB-03 | LB-01 | Gửi Phụ lục D.1 hoặc D.2 với `copies: 5` | Đúng 5 tem (payload được lặp 5 lần) |
| LB-04 | LB-01 | Gửi Phụ lục D.3 (chữ tiếng Việt) với **Mã hoá ký tự** `utf-8`, rồi `ascii` | `ascii`: chữ không dấu. `utf-8`: ghi lại những gì in ra (mẫu ZPL dùng `^CI28`; mẫu TSPL không đặt code page). Dấu đúng, hoặc ghi lại giới hạn |

## 5. Web Serial (thiết bị: máy in serial hoặc USB-serial)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| WS-01 | Máy in trên cổng COM/serial | 1. **Thiết bị** → **Cấp quyền cổng Serial…** (*Grant a serial port…*) → chọn cổng. 2. **Máy in** → sửa `printer-serial` (kiểu kết nối **Web Serial (lệnh RAW)**) → **Thiết bị** → chọn cổng → đặt **Baud rate** đúng giá trị của máy in (9600–115200; data bits 8, stop bits 1, không parity, không flow control là cố định) → **Lưu**. 3. Gán `SERIAL_TEST` → `printer-serial`. 4. Khởi động lại Chrome | Cổng hiện trong danh sách (`Serial vvvv:pppp`, hoặc `Serial port #n` nếu không có USB id) và vẫn còn sau khi khởi động lại; cấu hình **Sẵn sàng** |
| WS-02 | WS-01, máy in hoá đơn | Lặp lại EP-02, EP-04, EP-05 với `documentType: 'SERIAL_TEST'` | Kết quả như các case WebUSB; outcome của job là `BYTES_WRITTEN_TO_PORT` |
| WS-03 | WS-01, máy in tem | Lặp lại LB-01, LB-02 với `documentType: 'SERIAL_TEST'` | Kết quả như các case WebUSB |
| WS-04 | WS-01 | Đặt sai **Baud rate**, in | Ghi lại những gì in ra và trạng thái job. Web Serial không phát hiện được baud sai, nên dự kiến job kết thúc `SUBMITTED` kèm ký tự rác hoặc không in gì |

## 6. Lỗi thiết bị

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| ER-01 | EP-02 | Gửi Phụ lục C.4 (hoá đơn dài, hơn 16 KB) và rút cáp USB khi đang in | Không treo; job kết thúc trong khoảng 1 phút. Nếu đã ghi được một phần byte: `FAILED`, outcome `PARTIAL_TRANSFER`, `errorCode` `TRANSFER_FAILED`, không thử lại (để tránh in trùng). Nếu lỗi xảy ra trước khi ghi byte nào: `TRANSFER_FAILED` / `DEVICE_DISCONNECTED` được phép thử lại, nên job được thử tối đa 3 lần (cột **Kết quả** hiện `RETRY_AFTER_…` trong lúc đó) rồi kết thúc `FAILED`, thường là `DEVICE_NOT_FOUND`. Nếu máy in đã nhận hết vào bộ đệm, job có thể kết thúc `SUBMITTED` dù giấy ngừng ra. Ghi lại trường hợp nào xảy ra; **Lịch sử in** hiện lỗi |
| ER-02 | ER-01 | Cắm lại, in lại | In được; ghi lại có phải cấp quyền thiết bị lại ở **Thiết bị** hay không |
| ER-03 | Mở nắp máy in hoặc hết giấy | In | Ghi lại máy in phản ứng thế nào và trạng thái/outcome của job |
| ER-04 | Windows, driver mặc định `usbprint.sys` đang giữ máy in (chưa cài WinUSB) | In tới `printer-k80` | `FAILED`, `errorCode` `DEVICE_BUSY` sau 3 lần thử, thông báo `Cannot claim USB interface (…). The OS printer driver may own it.` hoặc `Cannot open USB device (…). Another driver or tab may hold it.` **Dự kiến FAIL cho tới T9:** thông báo và trang quản trị chưa trỏ tới hướng dẫn khắc phục |
| ER-05 | EP-01 | (a) Thu hồi thiết bị ở **Thiết bị** → **Thu hồi quyền** (*Revoke*), hoặc rút thiết bị, rồi in tới loại chứng từ đã gán. (b) Sửa một cấu hình WebUSB, bỏ chọn **Thiết bị** (chọn **Chọn thiết bị đã cấp quyền…**), in | (a) `FAILED`, `DEVICE_NOT_FOUND` (`USB printer not connected or permission not granted`) sau 3 lần thử (được thử lại; giữa các lần thấy `RETRY_AFTER_DEVICE_NOT_FOUND`). (b) `FAILED`, `DEVICE_NOT_FOUND` (`Profile has no USB device`) ngay, không thử lại |

## 7. Quyền thật (không cần máy in)

| ID | Điều kiện | Bước | Kết quả mong đợi |
|---|---|---|---|
| PM-01 | Website https thật, đã cài extension, website chưa được cho phép | (a) Quản trị: **Website** → nhập origin → **Cho phép website**. (b) Lặp lại với origin khác từ popup trên thanh công cụ, ở tab của website đó: **Cho phép website này** (*Allow this website*). Mỗi lần đều chấp nhận hộp thoại của Chrome | Hộp thoại của Chrome ghi đúng origin. Sau khi chấp nhận, origin hiện trong **Website** (và popup hiện **Đã được phép in** (*Allowed to print*)); `xp('ping')` trả lời trên website đó mà không cần tải lại tab |
| PM-02 | Website chưa được cho phép | (a) **Cho phép website**, rồi từ chối hộp thoại của Chrome. (b) Trước khi cho phép, chạy `await xp('ping', {}, 2000)` trên website (hoặc SDK `connect()`) | (a) Thông báo lỗi `Chrome permission was not granted`; origin không có trong danh sách; `chrome://extensions` → quyền truy cập trang không có origin đó. (b) Không có cửa sổ duyệt; helper báo lỗi `TIMEOUT` (SDK: `connect()` ném `NotInstalledError`, mã `NOT_INSTALLED`), vì cầu nối chỉ được chèn vào website đã cho phép |
| PM-03 | PM-01, luồng cửa sổ duyệt | 1. Ở **Website** bỏ tích **In** của website (chỉ còn **Đọc cấu hình**). 2. Trên website chạy `await xp('connect', { scopes: ['read','print'], sdkVersion: 'manual' })`. 3. Cửa sổ của extension "Website yêu cầu kết nối máy in" (*A website wants to use your printers*) mở, có origin của website và **In** được tích: (a) bấm **Cho phép** (*Allow*); lặp lại bước 1–2 và (b) bấm **Từ chối** (*Deny*) | (a) `connect` trả scope `["read","print"]`; `xprint` chạy được. (b) `connect` vẫn thành công với scope `["read"]` (không lỗi, vì website đã có quyền); `xprint` lỗi `PERMISSION_DENIED` (`Missing "print" permission`) |
| PM-04 | PM-03 | (a) Lặp lại bước 1–2 của PM-03 và để cửa sổ duyệt mở 2 phút. (b) Ở **Website** tích **Hỏi xác nhận mỗi lần in** (*Ask before every print*), gửi một job bất kỳ, duyệt trong vòng 2 phút. (c) Gửi job khác và để cửa sổ "Xác nhận lệnh in" (*Confirm print job*) 2 phút | (a) Cửa sổ tự đóng sau 2 phút, xử lý như từ chối: `connect` chỉ trả các scope đã có. (b) Job rời `WAITING_PERMISSION` và in. (c) Cửa sổ đóng sau 2 phút; job kết thúc `CANCELLED`, outcome `USER_DENIED`, `errorCode` `PERMISSION_DENIED` (SDK `print()` ném `PrintJobError`, mã `PERMISSION_DENIED`) |
| PM-05 | PM-01 | **Website** → **Thu hồi** (*Revoke*) website. Sau đó, trong một tab của website đó mở từ trước khi thu hồi và chưa tải lại, chạy `xp('getStatus')` và `xp('connect', …)`; rồi tải lại tab và chạy `xp('ping', {}, 2000)` | Website bị xoá khỏi danh sách và khỏi quyền truy cập trang trong `chrome://extensions`. Tab cũ: `getStatus` lỗi `ORIGIN_NOT_ALLOWED`; ghi lại `connect` có mở cửa sổ duyệt không (theo đọc code là có, và bấm **Cho phép** sẽ lỗi `PERMISSION_DENIED`, **Từ chối** sẽ lỗi `PAIRING_REJECTED`). Sau khi tải lại: không còn cầu nối (`ping` báo `TIMEOUT`) |

## Mẫu biên bản

Mỗi thiết bị và OS một bản.

```
Ngày:
Người test:
OS + phiên bản:
Phiên bản Chrome:
Phiên bản / commit extension:
Model máy in:
Kết nối (USB / serial / mạng):
Firmware / driver (và WinUSB/udev đã dùng):

Kết quả từng case (PASS / FAIL / N/A, kèm ghi chú và ID task lỗi):
PD-01 .. PD-05:
KP-01 .. KP-03:
EP-01 .. EP-06:
LB-01 .. LB-04:
WS-01 .. WS-04:
ER-01 .. ER-05:
PM-01 .. PM-05:

Ảnh (bản in, kèm tên file):
Kết luận (nâng lên Verified on Physical Printer? có/không):
```

## Phụ lục A — helper console

SDK chưa được phát hành, nên các case nói chuyện với extension bằng giao thức trang (`docs/vi/API.md`, mục "Protocol"). Dán vào console DevTools của một trang trên website đã cho phép. Nếu website của bạn đã đóng gói `@xdev/browser-print`, lệnh SDK tương đương ghi trong comment.

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

`format` là một trong `PDF`, `HTML`, `ESCPOS`, `ZPL`, `TSPL`, `RAW`. `dataEncoding` là `'text'` cho chuỗi hoặc `'base64'` cho byte (`PDF` và `RAW` bắt buộc base64). Payload text của định dạng RAW được mã hoá theo **Mã hoá ký tự** của cấu hình; payload base64 được gửi nguyên byte.

## Phụ lục B — mẫu cho hộp thoại in

B.1 Toa thuốc HTML A5 (PD-01, KP-01):

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

B.2 Hoá đơn PDF A4 từ file trên máy (PD-02). Chạy lệnh, rồi bấm vào ô chọn file hiện ở góc trên bên trái trang:

```js
const input = document.body.appendChild(Object.assign(document.createElement('input'), { type: 'file', accept: 'application/pdf' }));
input.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:#fff';
const file = await new Promise((r) => (input.onchange = () => r(input.files[0])));
input.remove();
await xprint({ documentType: 'INVOICE', format: 'PDF', dataEncoding: 'base64', data: b64(new Uint8Array(await file.arrayBuffer())) });
// SDK: await printer.printPdf('INVOICE', file)
```

B.3 Kiểm tra làm sạch HTML (PD-05). Thay URL ảnh bằng một ảnh https công khai bất kỳ:

```js
await xprint({ documentType: 'PRESCRIPTION', format: 'HTML', dataEncoding: 'text', data: `<html><body>
<h1 id="t">Sanitizer test</h1>
<script>alert('script ran'); document.getElementById('t').textContent = 'SCRIPT RAN';</script>
<p onclick="alert('handler ran')">Paragraph with an inline handler</p>
<img src="https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png" width="200" alt="remote image">
</body></html>` });
```

## Phụ lục C — mẫu ESC/POS

C.1 Hoá đơn (EP-02, EP-03, EP-04, WS-02). Payload text kèm lệnh ESC/POS; `cut: true` nối thêm `GS V 65 3`. Dùng `RECEIPT_K58` cho K58 và `SERIAL_TEST` cho serial:

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

C.2 Chữ tiếng Việt (EP-05):

```js
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'text', data: '\x1b@Phở bò, Nguyễn Thị Hương, Đà Nẵng\n\x1bd\x03' });
```

C.3 Mã QR, tuỳ chọn (EP-06). Extension không tạo mã này; đây là lệnh thô kiểu Epson `GS ( k` model 2 do người test cung cấp, repo này chưa kiểm chứng. Gửi dạng base64 để không bị mã hoá ký tự:

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

C.4 Hoá đơn dài cho test rút cáp (ER-01), khoảng 40 KB:

```js
await xprint({ documentType: 'RECEIPT', format: 'ESCPOS', dataEncoding: 'text', data: '\x1b@' + Array.from({ length: 1200 }, (_, i) => `Line ${String(i + 1).padStart(4, '0')} xDev unplug test ......\n`).join('') + '\x1bd\x03' });
```

## Phụ lục D — mẫu tem (50×30 mm)

D.1 ZPL ở 8 điểm/mm (203 dpi). Với 12 điểm/mm dùng `^PW600` và `^LL360`:

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

D.3 Chữ tiếng Việt trên tem (LB-04): trong D.1 thay trường đầu bằng `^FDBệnh nhân: Nguyễn Văn Ấn^FS`, hoặc trong D.2 thay giá trị `TEXT` đầu bằng `"Bệnh nhân: Nguyễn Văn Ấn"`.
