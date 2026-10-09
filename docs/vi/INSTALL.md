# Cài đặt tiện ích

Tiện ích đã gửi lên Chrome Web Store (dạng Unlisted) và đang chờ Google duyệt. Trong lúc link trên store chưa dùng được, hoặc với máy không chờ được, hãy cài bản build phát hành bằng tay.

## Từ Chrome Web Store

Khi trang tiện ích được duyệt: mở https://xdev.asia/vi/browser-print/ và bấm **Thêm vào Chrome**. Chrome tự cập nhật tiện ích.

## Cài thủ công (bản build phát hành)

Cần Google Chrome 118 trở lên trên Windows 10/11, macOS hoặc Linux.

1. Tải bản mới nhất: https://github.com/tdduydev/xdev-browser-print/releases/latest/download/xdev-browser-print.zip
   (mọi phiên bản: https://github.com/tdduydev/xdev-browser-print/releases).
2. Giải nén vào một thư mục cố định trên máy, ví dụ `Documents/xdev-browser-print`. Mỗi lần khởi động, Chrome nạp tiện ích từ thư mục này: đừng xoá hay di chuyển nó.
3. Mở `chrome://extensions` và bật **Chế độ dành cho nhà phát triển** (Developer mode, góc trên bên phải).
4. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục vừa giải nén (thư mục có file `manifest.json`).
5. Ghim **xDev Browser Print** từ biểu tượng mảnh ghép trên thanh công cụ, mở trang tuỳ chọn, rồi tạo cấu hình máy in, gán loại chứng từ và cho phép các website được in.

Kiểm tra thêm (không bắt buộc): so file ZIP với file `.sha256` cùng phiên bản trên trang release (`shasum -a 256 <file>.zip` trên macOS/Linux, `certutil -hashfile <file>.zip SHA256` trên Windows).

### Khác gì so với bản trên store

- **Không tự cập nhật.** Muốn cập nhật: tải ZIP mới, chép đè vào đúng thư mục cũ, rồi bấm biểu tượng tải lại trên thẻ tiện ích ở `chrome://extensions`. Cấu hình được giữ vì thư mục (và do đó ID tiện ích) không đổi.
- **ID tiện ích khác.** Bản cài thủ công và bản trên store là hai tiện ích riêng, cấu hình riêng. Ứng dụng web dùng SDK vẫn nhận ra cả hai, vì SDK làm việc với tiện ích có trên trang mà không cần ID cố định.
- Chrome có thể hiện thông báo về tiện ích ở chế độ nhà phát triển. Một số máy Chrome do công ty quản lý chặn chế độ này; khi đó hãy nhờ quản trị viên cho phép tiện ích bằng chính sách (policy).

### Chuyển sang bản trên store sau này

1. Cài từ Chrome Web Store.
2. Tạo lại cấu hình máy in, gán chứng từ và website được phép (chưa có chức năng xuất cấu hình).
3. Gỡ bản cài thủ công ở `chrome://extensions`, để hai bản không cùng trả lời một website.
