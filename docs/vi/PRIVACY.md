# Chính sách quyền riêng tư — xDev Browser Print

Bản tiếng Anh: [../PRIVACY.md](../PRIVACY.md)

Ngày hiệu lực: `<effective date>`

Chính sách này áp dụng cho tiện ích Chrome xDev Browser Print ("tiện ích"). Chính sách mô tả tiện ích làm gì với dữ liệu, đúng như mã nguồn tại https://github.com/tdduydev/xdev-browser-print.

## Tóm tắt

- Chứng từ bạn in được xử lý **chỉ trên máy tính của bạn** và chỉ đi tới máy in của bạn.
- Tiện ích **không tự gửi yêu cầu mạng nào**. Không có máy chủ, không có tài khoản, không có phân tích sử dụng, không quảng cáo, không theo dõi.
- Lịch sử in **chỉ lưu thông tin về lệnh in**, không bao giờ lưu nội dung chứng từ.
- Không bán, chia sẻ hay chuyển dữ liệu cho bất kỳ ai.

## Tiện ích xử lý những gì

### Chứng từ gửi để in

Các ứng dụng web mà bạn (hoặc quản trị viên) đã cho phép rõ ràng có thể gửi chứng từ tới tiện ích để in: PDF, HTML, hoặc lệnh máy in RAW (ESC/POS, ZPL, TSPL). Chứng từ có thể chứa thông tin cá nhân, sức khoẻ hoặc tài chính, ví dụ đơn thuốc hoặc hoá đơn.

- Chứng từ chỉ được giữ trong cơ sở dữ liệu cục bộ của tiện ích (IndexedDB) trong lúc lệnh in đang chạy, và **bị xoá ngay khi lệnh in kết thúc** (đã gửi, lỗi, bị huỷ, hoặc hộp thoại in đã đóng).
- Chứng từ chỉ được gửi tới máy in bạn đã cấu hình: qua hộp thoại in của Chrome, hoặc trực tiếp tới máy in USB/serial bạn đã cấp quyền cho tiện ích.
- Chứng từ HTML được in đúng như ứng dụng web viết. Nếu HTML đó tham chiếu ảnh hoặc stylesheet trên internet, Chrome tải chúng từ địa chỉ do ứng dụng web chọn, như với mọi trang web. Tiện ích không thêm dữ liệu nào vào các yêu cầu đó.

### Cấu hình

Lưu trong bộ nhớ cục bộ của tiện ích (`chrome.storage.local`) trên máy bạn, không bao giờ đồng bộ lên tài khoản Google:

- Cấu hình máy in: tên, khổ giấy, lề, hướng giấy, số bản, kiểu kết nối và, với máy in USB/serial, vendor ID, product ID và số serial USB của thiết bị, thông số cổng serial.
- Máy in dùng cho từng loại chứng từ.
- Cài đặt (ngôn ngữ, giới hạn kích thước và tần suất, độ dài lịch sử).
- Danh sách ứng dụng web bạn đã cho phép, theo đúng địa chỉ, kèm quyền bạn cấp cho từng trang.

Trong lúc bạn cho phép một website mới, địa chỉ của nó được giữ tối đa 5 phút trong bộ nhớ phiên của Chrome; Chrome xoá bộ nhớ này khi đóng trình duyệt.

### Lịch sử in

Với mỗi lệnh in, tiện ích lưu: mã lệnh, địa chỉ website gửi lệnh, loại chứng từ, định dạng, kích thước (byte), số bản, cấu hình máy in, trạng thái, kết quả, mã và thông báo lỗi, số lần thử và thời điểm. Tiện ích **không lưu nội dung chứng từ**.

Lịch sử được lưu trong cơ sở dữ liệu cục bộ của tiện ích, mặc định giữ 500 lệnh mới nhất (chỉnh được từ 10 đến 5000 trong Cài đặt). Bạn có thể xoá bất cứ lúc nào bằng "Xoá lịch sử".

### Địa chỉ tab hiện tại

Khi bạn mở popup của tiện ích trên thanh công cụ, tiện ích đọc địa chỉ tab hiện tại để cho biết website đó đã được phép in chưa. Địa chỉ này không được lưu, trừ khi bạn cho phép website đó.

### Thiết bị USB và serial

Tiện ích chỉ dùng được thiết bị USB hoặc serial mà bạn tự chọn trong hộp thoại chọn thiết bị của Chrome ở màn hình Thiết bị. Bạn có thể thu hồi quyền đó tại đây bất cứ lúc nào.

## Tiện ích không làm gì

- Không gửi dữ liệu nào cho nhà phát triển hay bên thứ ba.
- Không dùng phân tích sử dụng, telemetry, báo lỗi tự động, cookie hay quảng cáo.
- Không đọc nội dung trang web, lịch sử duyệt web, mật khẩu hay dữ liệu biểu mẫu.
- Không có quyền truy cập website nào cho đến khi bạn cho phép, và khi đó chỉ với đúng website đó.
- Không ghi log dữ liệu in.

## Dữ liệu lưu ở đâu và cách xoá

Mọi dữ liệu nằm trong hồ sơ Chrome trên máy bạn. Để xoá:

- Xoá website trong màn hình Website của tiện ích, hoặc gỡ quyền truy cập trang của tiện ích trong `chrome://extensions`.
- Xoá cấu hình máy in trong màn hình Máy in, và lịch sử bằng "Xoá lịch sử".
- Gỡ tiện ích. Khi đó Chrome xoá bộ nhớ cục bộ và cơ sở dữ liệu của tiện ích **[Chưa xác minh: hành vi của Chrome, không thuộc mã nguồn tiện ích]**.

## Trẻ em

Tiện ích là công cụ in chứng từ cho doanh nghiệp, không hướng tới trẻ em.

## Thay đổi chính sách

Thay đổi được công bố trong chính file này trên repo. Lịch sử của file cho thấy mọi thay đổi và ngày thay đổi.

## Liên hệ

`<contact email>`
