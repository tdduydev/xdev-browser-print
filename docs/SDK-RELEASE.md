# SDK release

The SDK is published to npmjs as `@tdduydev/browser-print` under the MIT license
(`LICENSE`, also shipped in the package). The extension and the SDK share one
version and one release.

## How a release publishes

1. Merge PRs with Conventional Commit titles into `main`. release-please keeps a
   Release PR with the next version and the CHANGELOG.
2. The workflow merges the Release PR by itself, tags `vX.Y.Z` and runs `release.yml`: lint,
   typecheck, unit and e2e tests, build, `pnpm check:sdk-package`, then
   `pnpm pack` of the SDK (which rewrites `workspace:*` ranges). The `.tgz` is
   attached to the GitHub Release.
3. The `npm-publish` job waits for a reviewer in the `npm` environment, then
   publishes that exact tarball. It does not rebuild.

Details:

- **No npm token.** The job uses npm trusted publishing (OIDC, npm ≥ 11.5.1),
  and npm adds provenance on its own. The trusted publisher on npmjs.com is this
  repository, workflow `release-please.yml` (the caller of `release.yml`), and
  environment `npm`.
- A version that is already on npm is skipped, not failed.
- Tags with a prerelease suffix (`v1.2.0-beta.1`) publish under the `next`
  dist-tag; other tags publish under `latest`.
- The job is skipped while the SDK is `UNLICENSED` or has no `LICENSE` file.

## First publish (once)

Trusted publishing is configured on a package that already exists, so the first
version goes up by hand from a maintainer's machine:

```bash
pnpm install --frozen-lockfile
pnpm --filter @tdduydev/browser-print build
pnpm --filter @tdduydev/browser-print pack --pack-destination release-npm
npm publish ./release-npm/tdduydev-browser-print-*.tgz --access public
```

Then on npmjs.com → package → Settings → Trusted publishing, add GitHub Actions
with owner `tdduydev`, repository `xdev-browser-print`, workflow
`release-please.yml`, environment `npm`. npm versions are immutable: a
published version can never be reused.

## Checks

CI runs `pnpm check:sdk-package` (npm pack dry-run): export files, README,
declarations without unpublished workspace imports, dependency ranges and
SDK/extension/tag agreement. After a release, install the package in an
external app to check ESM, CommonJS, TypeScript and the `/react` entry.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers),
[provenance](https://docs.npmjs.com/generating-provenance-statements/).
