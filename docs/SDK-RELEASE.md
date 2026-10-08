# SDK release

The SDK package name remains `@xdev/browser-print`. The release workflow prepares
public npmjs publishing after the GitHub Release, independently of the Chrome Web
Store job. **Public registry and license approval remain pending.** While the
SDK is `UNLICENSED` or has no `packages/browser-print-sdk/LICENSE` file, the
`npm-publish` job is skipped (not failed), so a tag still releases the extension.
Do not change the license without owner approval. If the
owner chooses private GitHub Packages, revise the registry, scope/authentication
and provenance requirements before enabling publication.

Before the first public release:

1. Confirm team ownership/publish rights for the npm `@xdev` scope.
2. Approve the SDK license, update its package metadata and include the license
   text covering the bundled core/shared-types code.
3. Confirm the GitHub repository is public and matches `repository.url` exactly.
   npm provenance requires a public source repository.
4. Create the GitHub `npm` environment with required reviewers. Add `NPM_TOKEN`
   as an environment secret, using a granular npm publish token with appropriate
   package/scope permissions and 2FA bypass. Never commit credentials.
5. release-please keeps the SDK, extension and root versions equal in its Release
   PR. To check a version locally: install with the frozen lockfile, build, then
   run `pnpm check:sdk-package vX.Y.Z`.
6. After normal review/merge, merge the release-please Release PR, which tags `vX.Y.Z` and runs the release (a hand-pushed tag also works). Approve
   the npm environment only after reviewing the release. npm versions are
   immutable; choose a fresh version for every attempt that actually publishes.
7. Confirm the npm package version and provenance, and install it in an external
   consumer to check ESM, CommonJS, TypeScript and the optional React entry.

How the workflow publishes:

- The `release` job packs the SDK with `pnpm pack` (which rewrites `workspace:*`
  ranges) after lint, typecheck, unit and e2e tests, and attaches the `.tgz` to
  the GitHub Release.
- `npm-publish` downloads that exact tarball and runs
  `npm publish <tgz> --provenance --access public`. It does not rebuild.
- Tags with a prerelease suffix (`v1.2.0-beta.1`) publish under the `next`
  dist-tag and create a GitHub prerelease; other tags publish under `latest`.
- Actions are pinned to commit SHAs.

CI builds the SDK and runs `npm pack --dry-run` via `pnpm check:sdk-package`.
This verifies export files, README, declarations without unpublished workspace
imports, dependency ranges and SDK/extension/tag agreement. It does not prove
registry permissions or that publication succeeded. No tag has been published
as part of T10's local verification.

References: [npm provenance](https://docs.npmjs.com/generating-provenance-statements/),
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).
