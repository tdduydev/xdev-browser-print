# Phát hành SDK

SDK được phát hành lên npmjs với tên `@tdduydev/browser-print`, license MIT
(file `LICENSE`, có trong package). Extension và SDK dùng chung một version và
một lần release.

## Cách một release được phát hành

1. Merge PR có tiêu đề theo Conventional Commits vào `main`. release-please giữ
   một Release PR chứa version tiếp theo và CHANGELOG.
2. Merge Release PR. Việc này tạo tag `vX.Y.Z` và chạy `release.yml`: lint,
   typecheck, unit test và e2e, build, `pnpm check:sdk-package`, rồi
   `pnpm pack` SDK (đổi `workspace:*` thành version thật). File `.tgz` được đính
   kèm vào GitHub Release.
3. Job `npm-publish` chờ người duyệt trong environment `npm`, rồi phát hành đúng
   tarball đó, không build lại.

Chi tiết:

- **Không có npm token.** Job dùng npm trusted publishing (OIDC, npm ≥ 11.5.1),
  npm tự thêm provenance. Trusted publisher trên npmjs.com là repo này, workflow
  `release-please.yml` (workflow gọi `release.yml`), environment `npm`.
- Version đã có trên npm thì được bỏ qua, không báo lỗi.
- Tag có hậu tố prerelease (`v1.2.0-beta.1`) phát hành với dist-tag `next`; tag
  khác dùng `latest`.
- Job bị bỏ qua khi SDK còn `UNLICENSED` hoặc thiếu file `LICENSE`.

## Phát hành lần đầu (một lần)

Trusted publishing được cấu hình trên package đã tồn tại, nên version đầu tiên
do maintainer phát hành bằng tay từ máy của mình:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tdduydev/browser-print build
pnpm --filter @tdduydev/browser-print pack --pack-destination release-npm
npm publish release-npm/tdduydev-browser-print-*.tgz --access public
```

Sau đó trên npmjs.com → package → Settings → Trusted publishing, thêm GitHub
Actions với owner `tdduydev`, repository `xdev-browser-print`, workflow
`release-please.yml`, environment `npm`. Version trên npm không thể ghi đè: đã
phát hành thì không dùng lại được.

## Kiểm tra

CI chạy `pnpm check:sdk-package` (npm pack dry-run): file exports, README,
declaration không import workspace chưa publish, dependency và version
SDK/extension/tag. Sau mỗi release, cài package vào một ứng dụng ngoài repo để
kiểm tra ESM, CommonJS, TypeScript và entry `/react`.

Tham khảo: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers),
[provenance](https://docs.npmjs.com/generating-provenance-statements/).
