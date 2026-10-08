# Bảo mật — xDev Browser Print

## 1. Mô hình tin cậy

| Thành phần | Mức tin cậy | Lý do |
|---|---|---|
| Service worker, trang extension | Tin cậy | Mã của extension, chạy dưới CSP của Manifest V3. |
| Origin đã được người dùng cho phép | Tin cậy giới hạn theo scope | Mọi script trên origin đó dùng được SDK. Ranh giới tin cậy là **origin**, không phải từng script. |
| Content script | Không giữ quyền | Chỉ chuyển message. Service worker kiểm tra lại mọi request. |
| Website khác, iframe, cửa sổ khác | Không tin cậy | Không có content script, hoặc bị chặn ở bước kiểm tra origin. |
| HTML/PDF do site gửi | Không tin cậy | Hiển thị sau khi làm sạch, trong iframe sandbox. |

## 2. Các lớp kiểm soát

| # | Kiểm soát | Nơi cài đặt | Test |
|---|---|---|---|
| S1 | Origin chính xác. Không chấp nhận wildcard, path, query, credentials. Chỉ `https:`. `http://localhost` và `http://127.0.0.1` chỉ khi bật cài đặt `allowLocalhost`. | `core/src/origin.ts` | `origin.test.ts` |
| S2 | Content script chỉ được đăng ký cho host người dùng cho phép. Manifest không có `content_scripts`. | `background/sites.ts` | e2e "never allowed gets no bridge" |
| S3 | Origin lấy từ `port.sender.origin` do Chrome cung cấp. Không đọc origin từ nội dung message. | `background/index.ts` | e2e "another port on an allowed host" |
| S4 | Bridge chỉ nhận port từ content script của chính extension, ở frame chính (`frameId === 0`) của một tab. | `background/index.ts` | Review code |
| S5 | Content script chỉ nhận message có `event.source === window` và `event.origin === location.origin`. Content script chỉ gửi trả về origin của trang. | `content/index.ts` | SDK test "ignores messages from other origins" |
| S6 | Scope `read`, `print`, `configure` theo từng method (`METHOD_SCOPES`). | `background/api.ts` | `page-api.test.ts`, e2e "scopes are enforced" |
| S7 | Thêm scope cần người dùng duyệt trong cửa sổ `approve.html`. Hết hạn sau 2 phút. Mỗi origin chỉ có một cửa sổ duyệt cùng lúc. | `background/approvals.ts` | e2e approve / deny |
| S8 | Cài đặt `allowSiteConfigure = false` chặn mọi thay đổi mapping từ site, kể cả khi site có scope `configure`. | `background/api.ts` | `page-api.test.ts` |
| S9 | Chống replay: `requestId` không được dùng lại. `sentAt` lệch quá 60 s bị từ chối. | `core/src/replay.ts` | `jobs-and-guards.test.ts`, `page-api.test.ts` |
| S10 | Chống in trùng: `idempotencyKey` theo từng origin. Job trùng trả job cũ, không in lại. | `printing/job-manager.ts` | unit + e2e |
| S11 | Rate limit theo origin. Mặc định 20 job / 60 s. | `core/src/rate-limit.ts` | unit + e2e |
| S12 | Giới hạn kích thước. Mặc định 15 MB sau giải mã. Content script chặn message > 70 MB ký tự. | `core/src/validation.ts`, `content/index.ts` | unit + e2e |
| S13 | Dữ liệu gắn nhãn PDF PHẢI bắt đầu bằng `%PDF`. | `core/src/validation.ts` | e2e "invalid documents" |
| S14 | HTML của site: DOMPurify bỏ `script`, `iframe`, `object`, `embed`, `form`, `input`, `base`, `meta`, `link`, event handler, URL `javascript:`. Sau đó hiển thị trong iframe `sandbox="allow-same-origin allow-modals"`. | `print/render.ts` | `render.test.ts`, e2e HTML job |
| S15 | Mỗi site chỉ thấy job của chính site đó. | `background/api.ts` | `page-api.test.ts` |
| S16 | Lỗi không rõ nguồn trả về thông báo chung, không kèm message gốc (message gốc có thể chứa dữ liệu bệnh nhân). | `core/src/errors.ts` | `page-api.test.ts` |
| S17 | Lịch sử in chỉ lưu thông tin job. Payload bị xoá khi job kết thúc. | `printing/job-manager.ts` | unit + e2e "metadata only" |
| S18 | `getPrinters()` không trả serial number, vendorId, cấu hình cổng. | `background/api.ts` | `page-api.test.ts` |
| S19 | Site có thể bật "Hỏi xác nhận mỗi lần in". Job chờ ở `WAITING_PERMISSION` tới khi người dùng duyệt. | `printing/job-manager.ts` | `job-manager.test.ts` |
| S20 | Message nội bộ (trang options, popup, cửa sổ in) chỉ nhận khi `sender.url` thuộc extension. Content script có cùng extension id nhưng URL là trang web, nên bị chặn. | `background/index.ts` | Review code |

## 3. Manifest V3 và CSP

- `content_security_policy.extension_pages`: `script-src 'self'; object-src 'self'; base-uri 'none'; form-action 'none'`.
- Không dùng `eval`, `new Function`, script từ CDN. ESLint chặn `no-eval`, `no-implied-eval`, `no-new-func`.
- Toàn bộ mã được bundle trong gói phát hành.

## 4. Quyền của extension

| Quyền | Dùng cho |
|---|---|
| `storage` | Lưu cấu hình và grant trong `chrome.storage.local`. |
| `scripting` | Đăng ký content script cho từng origin được phép. |
| `activeTab` | Popup đọc URL của tab hiện tại để đề xuất "Cho phép website này". |
| `optional_host_permissions`: `https://*/*`, `http://localhost/*`, `http://127.0.0.1/*` | Chỉ xin quyền cho **một host** khi người dùng thêm site. Không có quyền host nào lúc cài đặt. |

Bản build e2e (`XDBP_E2E=1`, thư mục `dist-e2e`) thêm `host_permissions: ["http://localhost/*"]` để test không cần hộp thoại quyền. Bản build này KHÔNG ĐƯỢC phát hành.

## 5. Rủi ro còn lại

| Rủi ro | Mức | Ghi chú |
|---|---|---|
| Script độc (XSS) trên origin đã được cho phép có thể gửi lệnh in. | Trung bình | Ranh giới là origin. Giảm thiểu: rate limit, scope tối thiểu, bật "Hỏi xác nhận mỗi lần in". |
| Extension khác có content script trên cùng trang có thể giả message của trang. | Thấp | Tương đương script của trang. Extension khác không đọc được cấu hình. |
| HTML in có thể tải ảnh/CSS từ URL ngoài. | Thấp | Site tự cung cấp HTML đó. Chưa chặn `img-src` để site dùng được logo qua https. |
| Thiết bị USB/Serial nhận byte tuỳ ý từ site có scope `print`. | Trung bình | Chỉ tới thiết bị người dùng đã cấp quyền và đã gán vào profile. |
