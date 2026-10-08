# Phát hành SDK

Giữ tên package `@xdev/browser-print`. Workflow chuẩn bị phát hành public lên
npmjs sau GitHub Release, độc lập với job Chrome Web Store. **Chưa chốt registry
public và license.** Khi SDK còn `UNLICENSED` hoặc chưa có file
`packages/browser-print-sdk/LICENSE`, job `npm-publish` bị bỏ qua (không báo lỗi),
nên tag vẫn phát hành extension. Không đổi license khi chưa được chủ sở hữu đồng ý. Nếu chọn GitHub Packages private, phải sửa registry,
scope/xác thực và yêu cầu provenance trước khi bật phát hành.

Trước lần phát hành public đầu tiên:

1. Xác nhận quyền sở hữu/phát hành scope npm `@xdev` của nhóm.
2. Duyệt license SDK, cập nhật metadata và thêm văn bản license bao phủ cả code
   core/shared-types đã gộp vào SDK.
3. Xác nhận repo GitHub public, khớp chính xác `repository.url`. npm provenance
   yêu cầu repo nguồn public.
4. Tạo environment GitHub `npm` với required reviewers; thêm secret `NPM_TOKEN`
   là granular token có quyền publish package/scope và bypass 2FA phù hợp.
   Không commit thông tin xác thực.
5. Đặt version SDK = extension thành version mới, cài bằng frozen lockfile,
   build rồi chạy `pnpm check:sdk-package vX.Y.Z`.
6. Sau review/merge, maintainer được ủy quyền push tag `vX.Y.Z`. Chỉ duyệt
   environment npm sau khi xem release. Version npm không thể ghi đè; mỗi lần
   đã publish phải dùng version mới cho lần tiếp theo.
7. Xác nhận version và provenance trên npm; cài vào ứng dụng ngoài repo để kiểm
   tra ESM, CommonJS, TypeScript và entry React tùy chọn.

Cách workflow phát hành:

- Job `release` đóng gói SDK bằng `pnpm pack` (đổi `workspace:*` thành version
  thật) sau khi qua lint, typecheck, unit test và e2e, rồi đính kèm `.tgz` vào
  GitHub Release.
- `npm-publish` tải đúng tarball đó và chạy
  `npm publish <tgz> --provenance --access public`, không build lại.
- Tag có hậu tố prerelease (`v1.2.0-beta.1`) phát hành với dist-tag `next` và
  tạo GitHub prerelease; tag khác dùng `latest`.
- Các action được ghim theo commit SHA.

CI build SDK và chạy `npm pack --dry-run` qua `pnpm check:sdk-package`, kiểm tra
file exports, README, declaration không import workspace chưa publish, dependency
và version SDK/extension/tag. Kiểm tra này không chứng minh quyền registry hay
publish thành công. T10 chưa phát hành tag nào trong kiểm tra cục bộ.

Tham khảo: [npm provenance](https://docs.npmjs.com/generating-provenance-statements/),
[package public có scope](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
